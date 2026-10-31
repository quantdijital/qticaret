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
  /** The option the buyer chose: its carrier is the invoice's before the parcel leaves. */
  shipping_option_id?: string | null
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

/** Two lines' amounts as one, at the first's KDV rate. */
const joined = (first: TotalledLine, second: TotalledLine): TotalledLine => ({
  quantity: 1,
  subtotal: MathBN.add(first.subtotal ?? 0, second.subtotal ?? 0).toString(),
  discount_subtotal: MathBN.add(
    first.discount_subtotal ?? 0,
    second.discount_subtotal ?? 0
  ).toString(),
  tax_total: MathBN.add(first.tax_total ?? 0, second.tax_total ?? 0).toString(),
  total: MathBN.add(first.total ?? 0, second.total ?? 0).toString(),
  tax_lines: first.tax_lines ?? null,
})

const quantityOf = (line: TotalledLine): number => MathBN.convert(line.quantity ?? 0).toNumber()

/**
 * Shipping as lines of their own, with the cash on delivery fee on the
 * charged one of its KDV rate: the shop's accountant counts the fee as part
 * of delivery (docs/mali-musavir-sorulari.md 2.3, 2026-10-31). Shipping that
 * is free leaves the fee a delivery line alone; a fee at another rate than
 * every shipping line keeps its own line, as one line has one rate.
 */
function deliveryLines(fees: InvoiceItem[], methods: InvoiceShippingMethod[]): InvoiceLine[] {
  const charged = methods.filter((method) => kurusOf(method.total) > 0)
  const fee = fees.reduce<TotalledLine | null>(
    (sum, line) => (sum ? joined(sum, line) : { ...line, quantity: 1 }),
    null
  )
  const target = fee ? charged.find((method) => rateOf(method) === rateOf(fee)) : undefined
  const lines = charged.map((method) =>
    method === target && fee
      ? invoiceLine(
          joined(method, fee),
          describe(["Kargo bedeli", method.name, "kapıda ödeme dahil"]),
          1
        )
      : invoiceLine(method, describe(["Kargo bedeli", method.name]), 1)
  )
  if (fee && !target) {
    const alone = charged.length === 0 ? "Kargo bedeli - kapıda ödeme" : fees[0]?.title
    lines.push(invoiceLine(fee, describe([alone]), 1))
  }
  return lines
}

/**
 * The invoice's lines: each item, then delivery (shipping, with the cash on
 * delivery fee). A line with nothing left (an item edited out, free
 * shipping) is not written.
 */
export function invoiceLines(order: {
  items?: Rows<InvoiceItem>
  shipping_methods?: Rows<InvoiceShippingMethod>
}): InvoiceLine[] {
  const counted = present(order.items).filter((item) => quantityOf(item) > 0)
  const items = counted
    .filter((item) => !isFeeLine(item))
    .map((item) => {
      const variant = item.variant_title === item.product_title ? null : item.variant_title
      return invoiceLine(
        item,
        describe([item.product_title ?? item.title, variant]),
        quantityOf(item)
      )
    })
  const fees = counted.filter((item) => isFeeLine(item))
  return [...items, ...deliveryLines(fees, present(order.shipping_methods))]
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
