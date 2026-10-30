import { MathBN } from "@medusajs/framework/utils"
import { ZERO_KURUS, addKurus, fromMedusaAmount, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import { isFeeLine } from "../payments/cod"
import type { InvoiceLine } from "./types"

type Rows<T> = (T | null)[] | null | undefined

/**
 * A line as Medusa totals it (v2.21.2 `getLineItemTotals`): `subtotal` is
 * KDV excluded and before the discount, `discount_subtotal` the discount
 * KDV excluded, `tax_total` the KDV after the discount, `total` what the
 * buyer pays for it. Shipping methods total the same way.
 */
interface TotalledLine {
  quantity?: MedusaAmount | null
  subtotal?: MedusaAmount | null
  discount_subtotal?: MedusaAmount | null
  tax_total?: MedusaAmount | null
  total?: MedusaAmount | null
  tax_lines?: Rows<{ rate?: number | string | null }>
}

export interface InvoiceItem extends TotalledLine {
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  variant_id?: string | null
  is_custom_price?: boolean | null
  metadata?: Record<string, unknown> | null
}

export interface InvoiceShippingMethod extends TotalledLine {
  name?: string | null
}

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

/** A line's KDV rate in percent; one without a tax line is 0 (exempt). */
const rateOf = (line: TotalledLine): number =>
  present(line.tax_lines).reduce((sum, tax) => sum + Number(tax.rate ?? 0), 0)

// Long enough for a product and its variant; programs cut longer text
const DESCRIPTION_MAX = 200

const describe = (parts: (string | null | undefined)[]): string =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" - ")
    .slice(0, DESCRIPTION_MAX)

function invoiceLine(line: TotalledLine, description: string, quantity: number): InvoiceLine {
  const subtotal = line.subtotal ?? 0
  const discount = kurusOf(line.discount_subtotal)
  return {
    description,
    quantity,
    unit_net: MathBN.div(subtotal, quantity).toFixed(4),
    discount_net: toMedusaAmount(discount),
    vat_rate: rateOf(line),
    net: toMedusaAmount(kurusOf(MathBN.sub(subtotal, line.discount_subtotal ?? 0))),
    vat: toMedusaAmount(kurusOf(line.tax_total)),
    gross: toMedusaAmount(kurusOf(line.total)),
  }
}

/**
 * The invoice's lines: each item (a payment fee by its own title), then
 * shipping as a line of its own. A line with nothing left (an item edited
 * out, free shipping) is not written.
 */
export function invoiceLines(order: {
  items?: Rows<InvoiceItem>
  shipping_methods?: Rows<InvoiceShippingMethod>
}): InvoiceLine[] {
  const items = present(order.items).flatMap((item) => {
    const quantity = MathBN.convert(item.quantity ?? 0).toNumber()
    if (quantity <= 0) {
      return []
    }
    const variant = item.variant_title === item.product_title ? null : item.variant_title
    const description = isFeeLine(item)
      ? describe([item.title])
      : describe([item.product_title ?? item.title, variant])
    return [invoiceLine(item, description, quantity)]
  })
  const shipping = present(order.shipping_methods).flatMap((method) =>
    kurusOf(method.total) > 0
      ? [invoiceLine(method, describe(["Kargo bedeli", method.name]), 1)]
      : []
  )
  return [...items, ...shipping]
}

/** The lines' sums, each from the lines' own rounded amounts. */
export function invoiceTotals(lines: readonly InvoiceLine[]) {
  const sum = (pick: (line: InvoiceLine) => string) =>
    toMedusaAmount(lines.reduce((total, line) => addKurus(total, kurusOf(pick(line))), ZERO_KURUS))
  return {
    net: sum((line) => line.net),
    vat: sum((line) => line.vat),
    gross: sum((line) => line.gross),
  }
}
