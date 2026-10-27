import { MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { WebhookEvent } from "./models/webhook-event"

// A run this quiet is taken as stopped (a crash), and the event may be tried again
const PROCESSING_STALE_MS = 2 * 60 * 1000

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
  ): Promise<{ id: string; state: ClaimState }> {
    try {
      const created = await this.createWebhookEvents({ provider, event_key: eventKey, summary })
      return { id: created.id, state: "new" }
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
      return { id: existing.id, state: "done" }
    }
    const quiet = Date.now() - new Date(existing.updated_at).getTime()
    if (existing.status === "processing" && quiet < PROCESSING_STALE_MS) {
      return { id: existing.id, state: "busy" }
    }
    await this.updateWebhookEvents({
      id: existing.id,
      status: "processing",
      attempts: existing.attempts + 1,
      error_code: null,
    })
    return { id: existing.id, state: "retry" }
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
