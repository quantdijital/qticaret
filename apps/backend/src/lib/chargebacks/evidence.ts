import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { orderPaymentDetails } from "../../workflows/payments/payment-details"
import { renderEvidence } from "./evidence-page"

export interface EvidenceOrder {
  display_id: number
  created_at: string
  email: string | null
  currency_code: string
  total: number
  shipping_total: number
  items: { title: string; quantity: number; total: number }[]
  shipping_address: Record<string, string | null> | null
  fulfillments: {
    created_at: string
    shipped_at: string | null
    delivered_at: string | null
    tracking: string[]
  }[]
}

export interface EvidenceChargeback {
  id: string
  order_id: string
  provider: string
  provider_reference: string | null
  amount: number
  currency_code: string
  reason: string
  status: string
  due_at: Date | string | null
  created_at: Date | string
}

/**
 * The evidence for a dispute (adr/0030), as one self-contained HTML
 * document the shop sends to the provider (or prints to PDF): the order,
 * its delivery address, the provider's own record of the payment, the
 * shipments and the refunds made. What the platform does not keep yet
 * (the shopper's consent records, F13) is named, not left out silently.
 */
export async function chargebackEvidence(
  container: MedusaContainer,
  chargeback: EvidenceChargeback
): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "display_id",
      "created_at",
      "email",
      "currency_code",
      "total",
      "shipping_total",
      "items.title",
      "items.quantity",
      "items.total",
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
    ],
    filters: { id: chargeback.order_id },
  })
  const row = data[0] as unknown as
    | (Omit<EvidenceOrder, "fulfillments"> & {
        fulfillments?: ({
          created_at: string
          shipped_at?: string | null
          delivered_at?: string | null
          labels?: ({ tracking_number?: string | null } | null)[] | null
        } | null)[]
      })
    | undefined
  if (!row) {
    throw new Error(`order ${chargeback.order_id} of chargeback ${chargeback.id} is gone`)
  }
  const order: EvidenceOrder = {
    ...row,
    fulfillments: (row.fulfillments ?? []).flatMap((fulfillment) =>
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
    ),
  }
  const payments = await orderPaymentDetails(container, chargeback.order_id)
  return renderEvidence({ chargeback, order, payments, generatedAt: new Date() })
}
