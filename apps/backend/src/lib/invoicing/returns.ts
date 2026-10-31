import { MathBN } from "@medusajs/framework/utils"
import type { InvoiceOrder } from "./draft"
import type { InvoiceItem } from "./lines"

/** A line that came back, as the return request counts it. */
export interface ReturnedLine {
  line_item_id: string
  quantity: number
}

const share = (value: unknown, ratio: ReturnType<typeof MathBN.convert>) =>
  MathBN.mult(MathBN.convert((value as number | string | null | undefined) ?? 0), ratio).toString()

/** An order line at the quantity returned, each of its amounts in that share. */
function returnedItem(item: InvoiceItem, quantity: number): InvoiceItem {
  const ordered = MathBN.convert(item.quantity ?? 0)
  const ratio = MathBN.div(quantity, ordered)
  return {
    ...item,
    quantity,
    subtotal: share(item.subtotal, ratio),
    discount_subtotal: share(item.discount_subtotal, ratio),
    tax_total: share(item.tax_total, ratio),
    total: share(item.total, ratio),
  }
}

/**
 * The order as far as a return goes back (the accountant, 2026-10-31,
 * docs/mali-musavir-sorulari.md 5.2): only the lines that came back, each
 * at the quantity returned and its amounts (discount and KDV included) the
 * order line's in that share; shipping when the shop gave it back too.
 * Its invoice lines are the return document's.
 */
export function returnedOrder<T extends InvoiceOrder>(
  order: T,
  returned: readonly ReturnedLine[],
  withShipping: boolean
): T {
  const items = (order.items ?? []).flatMap((item) => {
    const back = returned.find((line) => line.line_item_id === item?.id)
    const ordered = MathBN.convert(item?.quantity ?? 0).toNumber()
    if (!item || !back || back.quantity <= 0 || ordered <= 0) {
      return []
    }
    return [returnedItem(item, Math.min(back.quantity, ordered))]
  })
  return { ...order, items, shipping_methods: withShipping ? order.shipping_methods : [] }
}
