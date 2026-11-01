import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ParcelVars } from "../../../lib/messaging/templates"
import { carrierNameOf, trackingUrlOf } from "../../../lib/shipping/carriers"
import { GREETING, firstText, personName } from "./types"
import type { Loaded } from "./types"

const FIELDS = [
  "id",
  "provider_id",
  "metadata",
  "data",
  "labels.tracking_number",
  "labels.tracking_url",
  "items.title",
  "items.quantity",
  "items.line_item_id",
  "order.id",
  "order.display_id",
  "order.email",
  "order.customer_id",
  "order.shipping_address.first_name",
  "order.shipping_address.phone",
  "order.items.id",
  "order.items.product_title",
  "order.items.variant_title",
]

interface FulfillmentRow {
  provider_id: string | null
  metadata: Record<string, unknown> | null
  data: Record<string, unknown> | null
  labels: ({ tracking_number?: string | null; tracking_url?: string | null } | null)[] | null
  items: ({ title?: string | null; quantity: unknown; line_item_id?: string | null } | null)[]
  order: {
    display_id: number
    email: string | null
    customer_id: string | null
    shipping_address: { first_name?: string | null; phone?: string | null } | null
    items: ({ id: string; product_title?: string | null; variant_title?: string | null } | null)[]
  } | null
}

/**
 * A parcel as its messages show it (adr/0036), and where they go; null
 * when it is gone or the shop chose not to tell the customer when it
 * shipped it ("Kargoya ver" without notice).
 */
export async function loadParcelMessage(
  container: Pick<MedusaContainer, "resolve">,
  fulfillmentId: string
): Promise<Loaded<ParcelVars> | null> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "fulfillment", fields: FIELDS, filters: { id: fulfillmentId } })
  const row = data[0] as FulfillmentRow | undefined
  const order = row?.order
  if (!row || !order || row.metadata?.["qt_notify"] === false) {
    return null
  }
  const lines = new Map(order.items.flatMap((item) => (item ? [[item.id, item]] : [])))
  const label = (row.labels ?? []).find((each) => each?.tracking_number)
  return {
    vars: {
      number: String(order.display_id),
      customerName: personName(order.shipping_address?.first_name) ?? GREETING,
      carrier: carrierNameOf(row.provider_id, row.data),
      trackingNumber: label?.tracking_number ?? null,
      trackingUrl: trackingUrlOf(label?.tracking_url),
      items: row.items.flatMap((item) => {
        const line = item?.line_item_id ? lines.get(item.line_item_id) : undefined
        return item
          ? [
              {
                title: firstText(line?.product_title, item.title) ?? "",
                detail: firstText(line?.variant_title),
                quantity: Number(item.quantity),
              },
            ]
          : []
      }),
    },
    recipients: { email: order.email, sms: order.shipping_address?.phone ?? null },
    receiverId: order.customer_id,
    resourceType: "fulfillment",
  }
}
