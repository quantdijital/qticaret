import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { READ_STATE_KEY, allReadUntil, withRead } from "../../lib/notifications/feed"
import type { ReadState } from "../../lib/notifications/feed"
import { readerOf } from "./list"

export interface MarkAlertsReadInput {
  user_id: string
  /** These alerts read; ignored with `all`. */
  ids?: string[] | undefined
  /** Every alert up to the newest one read. */
  all?: boolean | undefined
}

/**
 * Marks alerts read for one staff member (adr/0020): their own state on
 * their user record, never anyone else's. Only the feed's own rows are
 * kept; "all read" moves the floor to the newest alert's (server) time,
 * so one that arrives meanwhile stays unread. A later failure puts the
 * old state back.
 */
export const markAlertsReadStep = createStep(
  "notifications-mark-read",
  async (input: MarkAlertsReadInput, { container }) => {
    const { state, metadata } = await readerOf(container, input.user_id)
    const notifications = container.resolve(Modules.NOTIFICATION)
    let next: ReadState
    if (input.all) {
      const [newest] = await notifications.listNotifications(
        { channel: "feed" },
        { select: ["id", "created_at"], order: { created_at: "DESC" }, take: 1 }
      )
      if (!newest) {
        return new StepResponse({ state }, null)
      }
      next = allReadUntil(new Date(newest.created_at))
    } else {
      const asked = [...new Set(input.ids ?? [])]
      const found = asked.length
        ? await notifications.listNotifications(
            // `id` is a column of every model; Medusa's filter type leaves it out
            { id: asked, channel: "feed" } as Record<string, unknown>,
            { select: ["id"], take: asked.length }
          )
        : []
      next = withRead(
        state,
        found.map((row) => row.id)
      )
    }
    await container.resolve(Modules.USER).updateUsers({
      id: input.user_id,
      metadata: { ...metadata, [READ_STATE_KEY]: next },
    })
    return new StepResponse({ state: next }, { user_id: input.user_id, before: metadata })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    // Named even when it was not there: an update that merges metadata would keep it
    await container.resolve(Modules.USER).updateUsers({
      id: undo.user_id,
      metadata: { ...undo.before, [READ_STATE_KEY]: undo.before[READ_STATE_KEY] ?? null },
    })
  }
)

export const markAlertsReadWorkflow = createWorkflow(
  "notifications-mark-read",
  (input: MarkAlertsReadInput) => new WorkflowResponse(markAlertsReadStep(input))
)
