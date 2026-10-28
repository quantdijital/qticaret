import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  getVariantAvailability,
} from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { BACK_IN_STOCK_MODULE } from "../../modules/back-in-stock"
import type BackInStockModuleService from "../../modules/back-in-stock/service"
import { sendMessageWorkflow } from "../messaging/send-message"

type Container = Pick<MedusaContainer, "resolve">

// A notice per alert at a time: the lock lives a little longer than its sends
const LOCK_SECONDS = 30

/** The variants an inventory item's stock is for. */
export async function variantsOfItem(container: Container, inventoryItemId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "inventory_item",
    fields: ["variants.id"],
    filters: { id: inventoryItemId },
  })
  return (
    (data[0] as { variants?: ({ id: string } | null)[] } | undefined)?.variants ?? []
  ).flatMap((variant) => (variant ? [variant.id] : []))
}

/**
 * Tells the alerts of variants that can be bought again (F10.5, adr/0037
 * §4), once each: an alert is closed only when its e-mail went (or had
 * gone), so one that could not be sent waits for the next change. Under
 * a lock per variant, so two stock changes at once send one notice.
 */
export async function notifyStockAlerts(
  container: MedusaContainer,
  variantIds: string[]
): Promise<number> {
  const alerts = container.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
  const waiting = await alerts.listStockAlerts(
    { variant_id: variantIds, status: "active" },
    { select: ["variant_id"] }
  )
  const variants = [...new Set(waiting.map(({ variant_id: id }) => id))]
  if (variants.length === 0) {
    return 0
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["default_sales_channel_id"],
  })
  const channel = (stores[0] as { default_sales_channel_id?: string | null } | undefined)
    ?.default_sales_channel_id
  if (!channel) {
    return 0
  }
  const availability = await getVariantAvailability(query, {
    variant_ids: variants,
    sales_channel_id: channel,
  })
  let notified = 0
  for (const variantId of variants.filter((id) => (availability[id]?.availability ?? 0) > 0)) {
    await container.resolve(Modules.LOCKING).execute(
      `stock-alerts:${variantId}`,
      async () => {
        const active = await alerts.listStockAlerts(
          { variant_id: variantId, status: "active" },
          { select: ["id"] }
        )
        for (const { id } of active) {
          const { result } = await sendMessageWorkflow(container).run({
            input: { template: "stock.back_in_stock", resource_id: id },
          })
          const outcome = (result as { email?: string }).email
          if (outcome === "sent" || outcome === "duplicate") {
            await alerts.updateStockAlerts({ id, status: "notified", notified_at: new Date() })
            notified += 1
          }
        }
      },
      { timeout: LOCK_SECONDS }
    )
  }
  return notified
}

/** Catches what a stock change could not send: it never fails the change. */
export async function notifyStockAlertsSafely(container: MedusaContainer, variantIds: string[]) {
  try {
    return await notifyStockAlerts(container, variantIds)
  } catch (error) {
    logger.warn({ event: "stock_alerts.notify_failed", err: errorSummary(error) })
    return 0
  }
}
