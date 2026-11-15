import { createHash } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"
import { ValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { BACK_IN_STOCK_MODULE } from "../../../modules/back-in-stock"
import type BackInStockModuleService from "../../../modules/back-in-stock/service"
import { provenCustomer } from "../../../workflows/account/proven-customer"
import { sendMessageWorkflow } from "../../../workflows/messaging/send-message"
import type { StorePostStockAlertType } from "./validators"

interface VariantRow {
  id: string
  product_id: string
  manage_inventory: boolean
  product?: { status: string } | null
}

/**
 * POST /store/stock-alerts (F10.5, adr/0037 §4): to be told once when a
 * variant out of stock can be bought again. A signed-in customer who has
 * proven their address (`provenCustomer`) has the alert on at once; anyone
 * else's waits for the address to confirm it, and the answer to a guest
 * says the same whatever was there before.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostStockAlertType>,
  res: MedusaResponse
): Promise<void> {
  const { variant_id: variantId, email: given } = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id", "manage_inventory", "product.status"],
    filters: { id: variantId },
  })
  const variant = data[0] as VariantRow | undefined
  if (!variant || variant.product?.status !== "published" || !variant.manage_inventory) {
    throw new ValidationError("stock_alerts.not_tracked", { field: "variant_id" })
  }
  const salesChannelId = req.publishable_key_context?.sales_channel_ids[0] ?? ""
  const availability = await getVariantAvailability(query, {
    variant_ids: [variantId],
    sales_channel_id: salesChannelId,
  })
  if ((availability[variantId]?.availability ?? 0) > 0) {
    throw new ValidationError("stock_alerts.in_stock", { field: "variant_id" })
  }
  // A guest has no auth context at all
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  const customerId = auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null
  let email = given ?? null
  if (customerId) {
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["email"],
      filters: { id: customerId },
    })
    email = (customers[0] as { email: string | null } | undefined)?.email ?? null
  }
  if (!email) {
    throw new ValidationError("stock_alerts.email_required", { field: "email" })
  }
  // At once only for an address its owner has proven; a session alone is not proof
  const confirmed = customerId !== null && (await provenCustomer(req.scope, customerId))
  const alert = await req.scope.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE).subscribe({
    variant_id: variantId,
    product_id: variant.product_id,
    email,
    customer_id: customerId,
    confirmed,
  })
  res.status(202).json({ status: confirmed ? "active" : "pending" })
  if (alert.token) {
    sendMessageWorkflow(req.scope)
      .run({
        input: {
          template: "stock.alert_confirm",
          resource_id: alert.id,
          // A digest, never part of the token: the notification row keeps its key in the clear
          key: createHash("sha256").update(alert.token).digest("hex").slice(0, 16),
          extra: { token: alert.token },
        },
      })
      .catch((error: unknown) => {
        logger.warn({ event: "stock_alerts.confirm_send_failed", err: errorSummary(error) })
      })
  }
}
