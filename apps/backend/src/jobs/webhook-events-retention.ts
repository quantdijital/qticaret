import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { WEBHOOK_EVENTS_MODULE } from "../modules/webhook-events"
import type WebhookEventsModuleService from "../modules/webhook-events/service"

// Long past any provider's retries (PayTR, iyzico): a repeat this late is not expected
const RECORD_TTL_MS = 90 * 24 * 60 * 60 * 1000
const BATCH = 500
const MAX_BATCHES = 20

/** Deletes provider notification records older than 90 days (adr/0026 §5). */
export default async function webhookEventsRetention(container: MedusaContainer) {
  const service = container.resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
  let records = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const old = await service.listWebhookEvents(
      { created_at: { $lt: new Date(Date.now() - RECORD_TTL_MS) } },
      { select: ["id"], take: BATCH }
    )
    if (old.length > 0) {
      await service.deleteWebhookEvents(old.map((event) => event.id))
      records += old.length
    }
    if (old.length < BATCH) {
      break
    }
  }
  logger.info({ event: "webhook_events.retention", records })
}

export const config = {
  name: "webhook-events-retention",
  schedule: "45 3 * * *",
}
