import { ZERO_KURUS } from "../money"
import type { Kurus } from "../money"
import { shippingQuote } from "./quote"
import type { QuoteBasis, QuoteLine, ShippingQuoteContext } from "./quote"

/**
 * The cart's shipping before an address (WooCommerce's "shipping
 * calculator", simplified for Türkiye): the shop's main option priced by
 * the one quote checkout uses (adr/0087 §2), from the cart on the server.
 * A price that needs the destination or a carrier's quote is not guessed:
 * the checkout works it out. Nothing comes from the shopper but the cart.
 */

/** An option as Settings > Shipping lists it (`shopShippingOptions`). */
export interface ListedOption {
  id: string
  name: string
  carrier: string | null
  /** "flat": an amount; "table": the shop's desi table; otherwise a carrier's quote. */
  pricing: "flat" | "table" | "cheapest" | "fastest"
  /** Lira as Medusa writes it ("90.00"), KDV in, for a flat one; null otherwise. */
  amount: string | number | null
  /** Offered to shoppers (`enabled_in_store`). */
  in_store: boolean
}

const delivers = (option: ListedOption) => option.carrier !== "pickup" && option.in_store

/**
 * The shop's main option (Settings > Shipping "Kargo ücreti", #451): the
 * one saved as main, else the cheapest flat one that delivers, else the
 * first that does, as the panel reads it; only options shoppers are
 * offered count. Null when the shop delivers with none.
 */
export function primaryOptionOf(
  options: readonly ListedOption[],
  savedId: string | null | undefined
): ListedOption | null {
  const delivering = options.filter(delivers)
  const saved = delivering.find(({ id }) => id === savedId)
  if (saved) {
    return saved
  }
  const flats = delivering
    .filter(({ pricing }) => pricing === "flat")
    .sort(
      (a, b) => Number(a.amount ?? 0) - Number(b.amount ?? 0) || a.name.localeCompare(b.name, "tr")
    )
  return flats[0] ?? delivering[0] ?? null
}

/** How the main option's base price is made; null: only the checkout can say (a carrier's quote). */
export interface EstimatePricer<Line> {
  basis: QuoteBasis
  price: (lines: readonly Line[]) => Kurus | Promise<Kurus>
}

/**
 * "free": nothing to pay; "priced": `amount` (kuruş, KDV in);
 * "at_checkout": the checkout works it out (a carrier's quote, no option,
 * a parcel past the table); "not_needed": nothing in the cart travels.
 */
export type ShippingEstimate =
  | { status: "free" }
  | { status: "priced"; amount: Kurus }
  | { status: "at_checkout" }
  | { status: "not_needed" }

/** Thrown inside a quote whose base only the checkout can price. */
class Deferred extends Error {
  override readonly name = "Deferred"
}

export interface EstimateInput<Line extends QuoteLine> {
  lines: readonly Line[]
  /** The hook's reading for the cart (`shippingQuoteContext`); null: the base is charged. */
  context: ShippingQuoteContext | null
  /** The main option's pricer; null without an option, or for a carrier's quote. */
  pricer: EstimatePricer<Line> | null
  /** Whether the shop has an option shoppers can be sent with at all. */
  hasOption: boolean
}

/**
 * The estimate through `shippingQuote` itself: past the threshold or for
 * a basket of free products it is free whatever the option (a carrier is
 * never asked); otherwise the pricer's base with the class surcharge. A
 * pricer that refuses (a parcel past the table) leaves it to the checkout.
 */
export async function estimateShipping<Line extends QuoteLine>(
  input: EstimateInput<Line>
): Promise<ShippingEstimate> {
  if (!input.lines.some((line) => line.requires_shipping !== false)) {
    return { status: "not_needed" }
  }
  if (!input.hasOption) {
    return { status: "at_checkout" }
  }
  const { pricer } = input
  try {
    const amount = await shippingQuote({
      lines: input.lines,
      context: input.context,
      basis: pricer?.basis ?? "parcel",
      price: (lines) => {
        if (!pricer) {
          throw new Deferred()
        }
        return pricer.price(lines)
      },
    })
    return amount <= ZERO_KURUS ? { status: "free" } : { status: "priced", amount }
  } catch (error) {
    if (error instanceof Deferred || isRefusal(error)) {
      return { status: "at_checkout" }
    }
    throw error
  }
}

/** A price the shop's own rules refuse (`shipping.no_rate`, a bad stored amount): not a fault. */
const isRefusal = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { qtErrorKind?: unknown }).qtErrorKind === "validation"
