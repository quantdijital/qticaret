import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaAmount } from "../../lib/money"

const PAGE = 500

export interface MovedAmount {
  amount: MedusaAmount
  created_at: string | Date
}

/** A payment that took or gave back money, with its moves and its order. */
export interface MovedPayment {
  id: string
  provider_id: string
  data: Record<string, unknown> | null
  captures: (MovedAmount | null)[] | null
  refunds: (MovedAmount | null)[] | null
  payment_collection: { order?: { id: string; display_id: number } | null } | null
}

/** The ids of the payments that took or gave back money in `[from, to)`, any provider. */
async function paymentIdsMovedBetween(container: MedusaContainer, from: Date, to: Date) {
  const payments = container.resolve(Modules.PAYMENT)
  const window = { created_at: { $gte: from.toISOString(), $lt: to.toISOString() } }
  const ids = new Set<string>()
  for (const list of [
    (skip: number) => payments.listCaptures(window, { relations: ["payment"], take: PAGE, skip }),
    (skip: number) => payments.listRefunds(window, { relations: ["payment"], take: PAGE, skip }),
  ]) {
    for (let skip = 0; ; skip += PAGE) {
      const rows = await list(skip)
      for (const row of rows as { payment?: { id?: string } | null }[]) {
        // Typed as always there; a row whose payment did not load is skipped, not trusted
        if (row.payment?.id) {
          ids.add(row.payment.id)
        }
      }
      if (rows.length < PAGE) {
        break
      }
    }
  }
  return [...ids]
}

/**
 * The payments that took (a capture) or gave back (a refund) money in
 * `[from, to)`, with all their captures and refunds (the caller picks the
 * window's own by their dates) and their order (F11.3, F11.5). Amounts
 * come from the query, as numbers.
 */
export async function paymentsMovedBetween(
  container: MedusaContainer,
  from: Date,
  to: Date
): Promise<MovedPayment[]> {
  const ids = await paymentIdsMovedBetween(container, from, to)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: MovedPayment[] = []
  for (let start = 0; start < ids.length; start += PAGE) {
    const { data } = await query.graph({
      entity: "payment",
      fields: [
        "id",
        "provider_id",
        "data",
        "captures.amount",
        "captures.created_at",
        "refunds.amount",
        "refunds.created_at",
        "payment_collection.order.id",
        "payment_collection.order.display_id",
      ],
      filters: { id: ids.slice(start, start + PAGE) },
    })
    rows.push(...(data as unknown as MovedPayment[]))
  }
  return rows
}
