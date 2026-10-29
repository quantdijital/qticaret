import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { notificationText } from "../lib/notifications/messages"
import { STOCK_LEDGER_MODULE } from "../modules/stock-ledger"
import type StockLedgerModuleService from "../modules/stock-ledger/service"
import { TENANT_WEBHOOKS_MODULE } from "../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../modules/tenant-webhooks/service"
import type { DueDelivery } from "../modules/tenant-webhooks/service"
import { deliverWebhookWorkflow } from "../workflows/webhooks/deliver"

const STOCK_FEED = "stock_ledger"
// How long the delivery log keeps what is done with
const LOG_DAYS = 30
// Movements and deliveries taken per run; the next run takes the rest
const MOVEMENTS = 500
const DELIVERIES = 50

/**
 * The stock ledger's new movements as `stock.changed` (F11.7): read after
 * the cursor, in order, once. With no subscriber the cursor only moves on,
 * so a new subscription starts from now, not from the ledger's beginning.
 */
export async function queueStockChanges(container: MedusaContainer): Promise<number> {
  const hooks = container.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
  const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
  const after = await hooks.cursorOf(STOCK_FEED)
  if (!(await hooks.anyTakes("stock.changed"))) {
    const [last] = await ledger.listStockMovements(
      {},
      { order: { seq: "DESC" }, take: 1, select: ["seq"] }
    )
    if (last && last.seq > after) {
      await hooks.moveCursor(STOCK_FEED, last.seq)
    }
    return 0
  }
  const movements = await ledger.listStockMovements(
    { seq: { $gt: after } },
    { order: { seq: "ASC" }, take: MOVEMENTS }
  )
  if (movements.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { id: [...new Set(movements.map((movement) => movement.inventory_item_id))] },
  })
  const skus = new Map(
    (data as { id: string; sku: string | null }[]).map((item) => [item.id, item.sku])
  )
  let queued = 0
  for (const movement of movements) {
    queued += await hooks.enqueue("stock.changed", `stock.changed:${movement.id}`, {
      inventory_item_id: movement.inventory_item_id,
      sku: skus.get(movement.inventory_item_id) ?? null,
      location_id: movement.location_id,
      stocked: movement.stocked_after,
      reserved: movement.reserved_after,
      available: movement.stocked_after - movement.reserved_after,
      reason: movement.reason,
    })
  }
  await hooks.moveCursor(STOCK_FEED, movements[movements.length - 1]?.seq ?? after)
  return queued
}

/** Tells every admin, in the panel's bell, that a subscription was turned off. */
async function alertDisabled(container: MedusaContainer, delivery: DueDelivery) {
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "webhooks.disabled",
      resource_id: delivery.subscription_id,
      data: {
        kind: "webhook_disabled",
        host: new URL(delivery.url).host,
        ...notificationText("webhooks.disabled", { host: new URL(delivery.url).host }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "webhooks.alert_failed", err: errorSummary(error) })
    })
}

/** Sends the deliveries due (F11.7): each signed; a failure later and later (KK3). */
export async function deliverWebhooks(container: MedusaContainer, now: Date = new Date()) {
  const counts = { delivered: 0, failed: 0, disabled: 0 }
  const hooks = container.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
  // Turned off during this run: what it had claimed waits for it to be turned on again
  const off = new Set<string>()
  for (const delivery of await hooks.claimDue(DELIVERIES, now)) {
    if (off.has(delivery.subscription_id)) {
      continue
    }
    const { result } = await deliverWebhookWorkflow(container).run({ input: delivery })
    if (result.ok && result.status !== null) {
      await hooks.markDelivered(
        delivery,
        { status: result.status, duration_ms: result.duration_ms },
        now
      )
      counts.delivered += 1
      continue
    }
    const outcome = await hooks.markFailed(
      delivery,
      { status: result.status, duration_ms: result.duration_ms, code: result.code ?? "error" },
      now
    )
    counts.failed += 1
    if (outcome.disabled) {
      off.add(delivery.subscription_id)
      counts.disabled += 1
      await alertDisabled(container, delivery)
    }
  }
  return counts
}

export default async function tenantWebhooks(container: MedusaContainer) {
  try {
    await queueStockChanges(container)
  } catch (error) {
    logger.warn({ event: "webhooks.stock_feed_failed", err: errorSummary(error) })
  }
  const counts = await deliverWebhooks(container)
  await container
    .resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    .prune(new Date(Date.now() - LOG_DAYS * 24 * 60 * 60 * 1000))
    .catch((error: unknown) => {
      logger.warn({ event: "webhooks.prune_failed", err: errorSummary(error) })
    })
  if (counts.delivered + counts.failed > 0) {
    logger.info({ event: "webhooks.delivered", ...counts })
  }
}

export const config = {
  name: "tenant-webhooks",
  schedule: "* * * * *",
}
