import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { READ_STATE_KEY, allReadUntil, visibleFeed, withRead } from "../../lib/notifications/feed"
import type { ReadState } from "../../lib/notifications/feed"
import { readerOf } from "./list"

export interface MarkAlertsReadInput {
  user_id: string
  /** These alerts read; ignored with `all`. */
  ids?: string[] | undefined
  /** Every alert up to the newest one read. */
  all?: boolean | undefined
}

/** One person's marks at a time: each reads the state the other wrote. */
export const alertsReadLockKey = (userId: string) => `alerts-read:${userId}`

type Stored = ReadState | Record<string, unknown> | undefined

/**
 * Marks alerts read for one staff member (adr/0020): their own state on
 * their user record, never anyone else's. Only the alerts their role gets
 * count (`access.ts`, the role read here): "all read" moves the floor to
 * the newest of those (server time), so one that arrives meanwhile stays
 * unread and the floor never tells of an alert they do not get. Only the
 * state's own key is written (Medusa merges metadata's top-level keys);
 * a later failure puts that key back as it was.
 */
export const markAlertsReadStep = createStep(
  "notifications-mark-read",
  async (input: MarkAlertsReadInput, { container }) => {
    const reader = await readerOf(container, input.user_id)
    const users = container.resolve(Modules.USER)
    const before = reader.stored as Stored
    const notifications = container.resolve(Modules.NOTIFICATION)
    // `id` and the operators are every model's; Medusa's filter type names neither
    const visible = visibleFeed(reader.hidden) as Record<string, unknown>
    let next: ReadState
    if (input.all) {
      const [newest] = await notifications.listNotifications(visible, {
        select: ["id", "created_at"],
        order: { created_at: "DESC" },
        take: 1,
      })
      if (!newest) {
        return new StepResponse({ state: reader.state }, null)
      }
      next = allReadUntil(new Date(newest.created_at))
    } else {
      const asked = [...new Set(input.ids ?? [])]
      const found = asked.length
        ? await notifications.listNotifications(
            { ...visible, id: asked } as Record<string, unknown>,
            { select: ["id"], take: asked.length }
          )
        : []
      next = withRead(
        reader.state,
        found.map((row) => row.id)
      )
    }
    await users.updateUsers({ id: input.user_id, metadata: { [READ_STATE_KEY]: next } })
    return new StepResponse({ state: next }, { user_id: input.user_id, before })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    // An empty string takes the key off again (Medusa's metadata rule) when there was none
    await container.resolve(Modules.USER).updateUsers({
      id: undo.user_id,
      metadata: { [READ_STATE_KEY]: undo.before ?? "" },
    })
  }
)

export const markAlertsReadWorkflow = createWorkflow(
  "notifications-mark-read",
  (input: MarkAlertsReadInput) => {
    const key = transform({ input }, ({ input }) => alertsReadLockKey(input.user_id))
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    const marked = markAlertsReadStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(marked)
  }
)
