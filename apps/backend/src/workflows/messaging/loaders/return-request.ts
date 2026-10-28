import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ReturnVars } from "../../../lib/messaging/templates"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import { GREETING, firstText, personName } from "./types"
import type { Loaded } from "./types"

interface OrderRow {
  display_id: number
  email: string | null
  customer_id: string | null
  shipping_address: { first_name?: string | null } | null
  items: ({
    id: string
    product_title?: string | null
    title?: string | null
    variant_title?: string | null
  } | null)[]
}

/** Kuruş as a Turkish shopper reads it: `₺1.234,50`. */
const liraOfKurus = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount / 100)

/** A return or exchange request as its messages show it, and its order's e-mail; null when gone. */
export async function loadReturnMessage(
  container: Pick<MedusaContainer, "resolve">,
  requestId: string
): Promise<Loaded<ReturnVars> | null> {
  const [request] = await container
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ id: requestId }, { take: 1 })
  if (!request) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "display_id",
      "email",
      "customer_id",
      "shipping_address.first_name",
      "items.id",
      "items.product_title",
      "items.title",
      "items.variant_title",
    ],
    filters: { id: request.order_id },
  })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    return null
  }
  const lines = new Map(order.items.flatMap((item) => (item ? [[item.id, item]] : [])))
  const asked = request.items as unknown as { line_item_id: string; quantity: number }[]
  return {
    vars: {
      number: String(order.display_id),
      customerName: personName(order.shipping_address?.first_name) ?? GREETING,
      kind: request.kind,
      items: asked.map((each) => {
        const line = lines.get(each.line_item_id)
        return {
          title: firstText(line?.product_title, line?.title) ?? "",
          detail: firstText(line?.variant_title),
          quantity: each.quantity,
        }
      }),
      returnCode: request.return_code,
      amount: request.refund_amount === null ? null : liraOfKurus(request.refund_amount),
    },
    // A request's messages go by e-mail: its lines and code read poorly in an SMS
    recipients: { email: order.email },
    receiverId: request.customer_id ?? order.customer_id,
    resourceType: "return_request",
  }
}
