import { BigNumber, MathBN, getLineItemTotals } from "@medusajs/framework/utils"
import type { MedusaAmount } from "../money"
import type { InvoiceItem } from "./lines"

type Rows<T> = (T | null)[] | null | undefined

/** An order line with what its amounts are worked out from. */
export interface SoldItem extends InvoiceItem {
  raw_unit_price?: MedusaAmount | null
  is_tax_inclusive?: boolean | null
  adjustments?: Rows<{
    raw_amount?: MedusaAmount | null
    is_tax_inclusive?: boolean | null
    version?: number | null
  }>
}

/** What an order is read with for its lines as sold. */
export const SOLD_FIELDS = [
  "version",
  "items.raw_unit_price",
  "items.is_tax_inclusive",
  "items.adjustments.raw_amount",
  "items.adjustments.is_tax_inclusive",
  "items.adjustments.version",
]

// As Medusa stores and charges it (lib/orders/shares.ts): the raw value, not division noise
const stored = (amount: BigNumber): MedusaAmount => amount.raw ?? amount

function soldTotals(item: SoldItem & { raw_unit_price: MedusaAmount }, version: number | null) {
  const taxInclusive = item.is_tax_inclusive === true
  // Medusa copies a line's adjustments into each version of the order: the current one's count
  const adjustments = (item.adjustments ?? []).flatMap((row) =>
    row?.raw_amount === null ||
    row?.raw_amount === undefined ||
    (version !== null && row.version !== version)
      ? []
      : [
          {
            amount: MathBN.convert(row.raw_amount),
            is_tax_inclusive: row.is_tax_inclusive === true,
          },
        ]
  )
  const totals = getLineItemTotals(
    {
      id: item.id ?? "",
      unit_price: new BigNumber(item.raw_unit_price),
      quantity: new BigNumber(MathBN.convert(item.quantity ?? 0)),
      is_tax_inclusive: taxInclusive,
      tax_lines: (item.tax_lines ?? []).flatMap((line) =>
        line?.rate === null || line?.rate === undefined ? [] : [{ rate: Number(line.rate) }]
      ),
      adjustments,
    },
    { includeTax: taxInclusive }
  )
  return {
    subtotal: stored(totals.subtotal),
    discount_subtotal: stored(totals.discount_subtotal),
    tax_total: stored(totals.tax_total),
    total: stored(totals.total),
  }
}

/**
 * The order's lines at what they were sold for (adr/0010): Medusa's own
 * formula over the whole quantity ordered. The totals Medusa puts on an
 * order's lines shrink as units come back (a line received back reads 0),
 * while an invoice, and the return document of what came back, are for
 * what was sold. A line read without its price is left as it came.
 */
export function asSold<T extends { version?: number | null; items?: Rows<SoldItem> }>(order: T): T {
  const version = order.version ?? null
  return {
    ...order,
    items: (order.items ?? []).map((item) =>
      item?.raw_unit_price === null || item?.raw_unit_price === undefined
        ? item
        : { ...item, ...soldTotals({ ...item, raw_unit_price: item.raw_unit_price }, version) }
    ),
  }
}
