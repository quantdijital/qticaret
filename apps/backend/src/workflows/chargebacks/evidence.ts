import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { renderEvidence } from "../../lib/chargebacks/evidence-page"
import type { EvidenceChargeback, EvidenceOrder } from "../../lib/chargebacks/evidence-page"
import { orderPaymentDetails } from "../payments/payment-details"

const ORDER_FIELDS = [
  "display_id",
  "created_at",
  "email",
  "currency_code",
  "total",
  "shipping_total",
  "items.title",
  "items.quantity",
  "items.total",
  // An order edit's quantity and price reach the item only with its detail (adr/0033)
  "items.detail.quantity",
  "items.detail.unit_price",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.phone",
  "fulfillments.created_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.labels.tracking_number",
]

type OrderRow = Omit<EvidenceOrder, "fulfillments"> & {
  fulfillments?: ({
    created_at: string
    shipped_at?: string | null
    delivered_at?: string | null
    labels?: ({ tracking_number?: string | null } | null)[] | null
  } | null)[]
}

const shipmentsOf = (row: OrderRow): EvidenceOrder["fulfillments"] =>
  (row.fulfillments ?? []).flatMap((fulfillment) =>
    fulfillment
      ? [
          {
            created_at: fulfillment.created_at,
            shipped_at: fulfillment.shipped_at ?? null,
            delivered_at: fulfillment.delivered_at ?? null,
            tracking: (fulfillment.labels ?? []).flatMap((label) =>
              label?.tracking_number ? [label.tracking_number] : []
            ),
          },
        ]
      : []
  )

/**
 * The evidence for a dispute (adr/0030), as one self-contained HTML
 * document the shop sends to the provider (or prints to PDF): the order,
 * its delivery address, the provider's own record of the disputed
 * payment, the shipments and the refunds made. What the platform does not
 * keep yet (the shopper's consent records, F13) is named, not left out.
 */
export async function chargebackEvidence(
  container: MedusaContainer,
  chargeback: EvidenceChargeback
): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: chargeback.order_id },
  })
  const row = data[0] as unknown as OrderRow | undefined
  if (!row) {
    throw new Error(`order ${chargeback.order_id} of chargeback ${chargeback.id} is gone`)
  }
  const details = await orderPaymentDetails(container, chargeback.order_id)
  return renderEvidence({
    chargeback,
    order: { ...row, fulfillments: shipmentsOf(row) },
    payment: details.payments.find((each) => each.payment_id === chargeback.payment_id) ?? null,
    refunds: details.refunds,
    generatedAt: new Date(),
  })
}
