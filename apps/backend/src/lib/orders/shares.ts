import type { TaxLineDTO } from "@medusajs/framework/types"
import {
  BigNumber,
  MathBN,
  getLineItemTotals,
  getShippingMethodTotals,
} from "@medusajs/framework/utils"
import {
  allocateCappedKurus,
  allocateKurus,
  fromMedusaAmount,
  kurus,
  subtractKurus,
  weightOfMedusaAmount,
} from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * What each line of an order cost, was discounted and paid, in kuruş
 * (F4.7, adr/0010). Medusa spreads a discount over the items it applies to
 * in exact decimals (10% of 33.33 is 3.333); here those decimals become
 * kuruş that add up: the lines' payments to what the order charged, their
 * discounts to the order's discount, no line discounted past its price.
 * The payment basket, invoice lines and partial refunds read these.
 */

export type LineKind = "item" | "shipping"

export interface LineAmounts {
  id: string
  kind: LineKind
  quantity: number
  /** Before discounts, tax included (Medusa's `original_total`). */
  gross: MedusaAmount
  /** After discounts, tax included: what was paid for the line (Medusa's `total`). */
  net: MedusaAmount
}

export interface LineShare {
  id: string
  kind: LineKind
  quantity: number
  gross: Kurus
  discount: Kurus
  net: Kurus
}

type Facts<T> = (T | null)[] | null | undefined

export interface ItemFacts {
  id: string
  quantity: number
  unit_price: MedusaAmount
  is_tax_inclusive?: boolean | null
  tax_lines?: Facts<{ rate?: number | null }>
  adjustments?: Facts<{ amount?: MedusaAmount | null; is_tax_inclusive?: boolean | null }>
}

export interface ShippingFacts {
  id: string
  amount: MedusaAmount
  is_tax_inclusive?: boolean | null
  tax_lines?: Facts<{ rate?: number | null }>
  adjustments?: Facts<{ amount?: MedusaAmount | null }>
}

const ratesOf = (lines: Facts<{ rate?: number | null }>) =>
  (lines ?? []).flatMap((line) =>
    line?.rate === null || line?.rate === undefined ? [] : [{ rate: line.rate }]
  )

// Copies: Medusa writes each adjustment's own totals onto what it is given
const adjustmentsOf = (
  rows: Facts<{ amount?: MedusaAmount | null; is_tax_inclusive?: boolean | null }>
) =>
  (rows ?? []).flatMap((row) =>
    row?.amount === null || row?.amount === undefined
      ? []
      : [{ amount: MathBN.convert(row.amount), is_tax_inclusive: row.is_tax_inclusive === true }]
  )

/**
 * An amount as Medusa stores and charges it: its raw value, 20 digits.
 * The working value below that is division noise (tax taken out and put
 * back makes 90.045 into 90.04499…988), enough to round a half kuruş the
 * other way than the payment Medusa took.
 */
const stored = (amount: BigNumber): MedusaAmount => amount.raw ?? amount

/**
 * An item line's amounts for the whole quantity ordered, by Medusa's own
 * formula. Medusa's `total` on an order shrinks as units come back; a
 * line's shares must not, or each refund would move the next.
 */
export function itemAmounts(item: ItemFacts): LineAmounts {
  const taxInclusive = item.is_tax_inclusive === true
  const totals = getLineItemTotals(
    {
      id: item.id,
      unit_price: new BigNumber(item.unit_price),
      quantity: new BigNumber(item.quantity),
      is_tax_inclusive: taxInclusive,
      tax_lines: ratesOf(item.tax_lines),
      adjustments: adjustmentsOf(item.adjustments),
    },
    { includeTax: taxInclusive }
  )
  return {
    id: item.id,
    kind: "item",
    quantity: item.quantity,
    gross: stored(totals.original_total),
    net: stored(totals.total),
  }
}

/** A shipping line's amounts by Medusa's own formula (its adjustments carry no tax flag). */
export function shippingAmounts(method: ShippingFacts): LineAmounts {
  const taxInclusive = method.is_tax_inclusive === true
  const totals = getShippingMethodTotals(
    {
      id: method.id,
      amount: new BigNumber(method.amount),
      is_tax_inclusive: taxInclusive,
      // Medusa reads only the rate, and writes the line's tax back onto it
      tax_lines: ratesOf(method.tax_lines) as TaxLineDTO[],
      adjustments: adjustmentsOf(method.adjustments).map(({ amount }) => ({ amount })),
    },
    { includeTax: taxInclusive }
  )
  return {
    id: method.id,
    kind: "shipping",
    quantity: 1,
    gross: stored(totals.original_total),
    net: stored(totals.total),
  }
}

const roundedSum = (amounts: readonly MedusaAmount[]): Kurus =>
  fromMedusaAmount(
    amounts.reduce<MedusaAmount>((sum, amount) => MathBN.add(sum, amount), 0),
    { allowRounding: true }
  )

/**
 * The lines in kuruş: prices split by Medusa's exact prices (a kuruş price
 * stays as it is), the discount by its exact shares and capped by each
 * line's price, the payment as what is left. The payments add up to the
 * order's total rounded half-up, the amount a payment provider charges.
 */
export function lineShares(lines: readonly LineAmounts[]): LineShare[] {
  if (lines.length === 0) {
    return []
  }
  const gross = allocateKurus(
    roundedSum(lines.map((line) => line.gross)),
    lines.map((line) => weightOfMedusaAmount(line.gross))
  )
  const discountTotal = subtractKurus(
    roundedSum(lines.map((line) => line.gross)),
    roundedSum(lines.map((line) => line.net))
  )
  if (discountTotal < 0) {
    throw new RangeError("an order cannot be paid more than its price")
  }
  const discount = allocateCappedKurus(
    discountTotal,
    lines.map((line) => weightOfMedusaAmount(MathBN.sub(line.gross, line.net))),
    gross
  )
  return lines.map((line, index) => {
    const lineGross = gross[index] ?? kurus(0)
    const lineDiscount = discount[index] ?? kurus(0)
    return {
      id: line.id,
      kind: line.kind,
      quantity: line.quantity,
      gross: lineGross,
      discount: lineDiscount,
      net: subtractKurus(lineGross, lineDiscount),
    }
  })
}
