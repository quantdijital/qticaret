import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { WebhookEvent } from "./models/webhook-event"

// A run this quiet is taken as stopped (a crash), and the event may be tried again
const PROCESSING_STALE_MS = 2 * 60 * 1000

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * - `new`: first seen; handle it.
 * - `retry`: seen before and failed (or stopped): handle it again.
 * - `busy`: being handled right now: answer so the provider tries later.
 * - `done`: handled already: only acknowledge it.
 */
export type ClaimState = "new" | "retry" | "busy" | "done"

/** Incoming provider notifications, each handled once (adr/0026 §5). */
class WebhookEventsModuleService extends MedusaService({ WebhookEvent }) {
  /** Claims an event before it is handled; the database's unique key decides a race. */
  async claim(
    provider: string,
    eventKey: string,
    summary: Record<string, unknown>
  ): Promise<{ id: string; state: ClaimState; attempts: number }> {
    try {
      const created = await this.createWebhookEvents({ provider, event_key: eventKey, summary })
      return { id: created.id, state: "new", attempts: 1 }
    } catch (error) {
      if (!uniqueViolationKeys(error)) {
        throw error
      }
    }
    const [existing] = await this.listWebhookEvents({ provider, event_key: eventKey }, { take: 1 })
    if (!existing) {
      throw new Error(`webhook event ${provider}:${eventKey} vanished while claimed`)
    }
    if (existing.status === "processed") {
      return { id: existing.id, state: "done", attempts: existing.attempts }
    }
    const taken = await this.reclaim_(existing.id, existing.attempts)
    return taken
      ? { id: existing.id, state: "retry", attempts: existing.attempts + 1 }
      : { id: existing.id, state: "busy", attempts: existing.attempts }
  }

  /**
   * A failed event, or one stopped long enough, taken back for one more try,
   * as a single `UPDATE … WHERE`: of two racing retries one gets it.
   */
  @InjectTransactionManager()
  protected async reclaim_(
    id: string,
    attempts: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("webhook_event: a reclaim runs in a transaction")
    }
    const changed = await manager.nativeUpdate(
      "WebhookEvent",
      {
        id,
        deleted_at: null,
        $or: [
          { status: "failed" },
          { status: "processing", updated_at: { $lt: new Date(Date.now() - PROCESSING_STALE_MS) } },
        ],
      },
      { status: "processing", attempts: attempts + 1, error_code: null, updated_at: new Date() }
    )
    return changed > 0
  }

  /**
   * Counts one more take of a result a provider gives no notice id for
   * (iyzico's paid form, reached by the shopper's browser and the reconcile
   * job), so a completion that keeps failing reaches the shop as PayTR's
   * does. No claim: nothing is held, two takes at once both go on. How many
   * takes there have been, this one included.
   */
  async countTake(provider: string, eventKey: string): Promise<number> {
    try {
      await this.createWebhookEvents({ provider, event_key: eventKey })
      return 1
    } catch (error) {
      if (!uniqueViolationKeys(error)) {
        throw error
      }
    }
    return this.addTake_(provider, eventKey)
  }

  // One statement: of two takes at once neither is lost
  @InjectTransactionManager()
  protected async addTake_(
    provider: string,
    eventKey: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const manager = sharedContext.transactionManager as Executor | undefined
    if (!manager) {
      throw new Error("webhook_event: a take is counted in a transaction")
    }
    const [row] = (await manager.execute(
      `UPDATE webhook_event SET attempts = attempts + 1, updated_at = now()
        WHERE provider = ? AND event_key = ? AND deleted_at IS NULL
       RETURNING attempts`,
      [provider, eventKey]
    )) as { attempts?: unknown }[]
    const attempts = Number(row?.attempts)
    return Number.isInteger(attempts) ? attempts : 1
  }

  async markProcessed(id: string, summary?: Record<string, unknown>): Promise<void> {
    await this.updateWebhookEvents({
      id,
      status: "processed",
      processed_at: new Date(),
      ...(summary ? { summary } : {}),
    })
  }

  /** The error's code only, never its message (it may quote the notification). */
  async markFailed(id: string, errorCode: string): Promise<void> {
    await this.updateWebhookEvents({ id, status: "failed", error_code: errorCode })
  }
}

export default WebhookEventsModuleService
