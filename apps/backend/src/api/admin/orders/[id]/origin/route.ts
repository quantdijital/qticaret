import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { TRAFFIC_SOURCES_MODULE } from "../../../../../modules/traffic-sources"
import type TrafficSourcesModuleService from "../../../../../modules/traffic-sources/service"

/**
 * `GET /admin/orders/:id/origin` (O6): where the order's shopper first
 * landed from, as its cart recorded it (F11.2, adr/0039 §2): the class,
 * the campaign's `utm_*` words and the referring site's host. Nothing of
 * the person is kept there, so no personal data; `null` when nothing was
 * recorded (an order placed by the team, a shopper who blocked it).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params["id"] ?? ""
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "cart.id"],
    filters: { id: orderId },
  })
  const order = data[0] as { id: string; cart?: { id: string } | null } | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const cartId = order.cart?.id
  const [record] = cartId
    ? await req.scope
        .resolve<TrafficSourcesModuleService>(TRAFFIC_SOURCES_MODULE)
        .listTrafficSourceRecords({ cart_id: cartId }, { take: 1 })
    : []
  res.json({
    origin: record
      ? {
          source: record.source,
          utm_source: record.utm_source ?? null,
          utm_medium: record.utm_medium ?? null,
          utm_campaign: record.utm_campaign ?? null,
          referrer_host: record.referrer_host ?? null,
          landed_at: new Date(record.created_at).toISOString(),
        }
      : null,
  })
}
