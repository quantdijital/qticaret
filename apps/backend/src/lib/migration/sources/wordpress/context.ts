import type { MigrationKind, SourceStock, StepProblem } from "../../types"
import type { Wxr, WxrItem } from "./reader"
import type { Taxonomies } from "./terms"

/**
 * What each kind's mapping reads besides its own items: the export, its
 * taxonomies, its media library by id, products' variations by parent,
 * and the notes the report's "Notlar" sheet lists. WooCommerce's stored
 * amounts and measures are read here: lira as the shop showed them (KDV
 * included), weights in kg and sizes in cm (WooCommerce's defaults).
 */

export type Note = StepProblem & { kind: MigrationKind }

export interface WordpressContext {
  wxr: Wxr
  taxonomies: Taxonomies
  /** The media library, by attachment id. */
  attachments: ReadonlyMap<string, WxrItem>
  /** Variations by their product's id, in the shop's order. */
  variations: ReadonlyMap<string, WxrItem[]>
  siteHost: string | null
  notes: Note[]
}

export const note = (
  context: WordpressContext,
  kind: MigrationKind,
  source_key: string,
  key: string
): void => {
  context.notes.push({ kind, source_key: source_key.slice(0, 500), key })
}

// The catalog takes amounts up to this
const MAX_AMOUNT = 1_000_000_000

/** A stored amount ("2625", "2625.5") as the records keep it ("2625.00"); none for nothing or zero. */
export function amountOf(text: string | undefined): string | null {
  const value = Number((text ?? "").trim().replace(",", "."))
  return (text ?? "").trim() !== "" && Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT
    ? value.toFixed(2)
    : null
}

/** A positive measure ("0,75") as a number. */
export function measureOf(text: string | undefined): number | null {
  const value = Number((text ?? "").trim().replace(",", "."))
  return (text ?? "").trim() !== "" && Number.isFinite(value) && value > 0 && value <= 100_000
    ? value
    : null
}

/** Whether a sale's dates (Unix seconds, either may be missing) hold now. */
function saleHolds(from: string | undefined, to: string | undefined, now: number): boolean {
  const start = Number(from ?? "")
  const end = Number(to ?? "")
  return (
    (!from || !Number.isFinite(start) || start * 1000 <= now) &&
    (!to || !Number.isFinite(end) || now <= end * 1000)
  )
}

/**
 * What an item sells for now: its sale price while the sale holds, else
 * its regular price (`_price`, WooCommerce's own answer, when neither is
 * there). The regular one is kept as the crossed-out price, which the
 * migration does not show (adr/0042 G1 §4).
 */
export function priceOf(
  meta: ReadonlyMap<string, string>,
  now: number = Date.now()
): { price: string; compare_at_price: string | null } | null {
  const regular = amountOf(meta.get("_regular_price"))
  const sale = amountOf(meta.get("_sale_price"))
  const onSale =
    sale !== null &&
    saleHolds(meta.get("_sale_price_dates_from"), meta.get("_sale_price_dates_to"), now)
  const price = (onSale ? sale : regular) ?? amountOf(meta.get("_price"))
  if (!price) {
    return null
  }
  return {
    price,
    compare_at_price: onSale && regular && Number(regular) > Number(price) ? regular : null,
  }
}

const MAX_STOCK = 10_000_000

const counts = (meta: ReadonlyMap<string, string> | undefined) =>
  meta?.get("_manage_stock") === "yes"

// An empty count is none on hand, as WooCommerce reads it
function countOf(meta: ReadonlyMap<string, string>): number | null {
  const count = Math.floor(Number(meta.get("_stock") ?? ""))
  return Number.isFinite(count) ? Math.min(Math.max(count, 0), MAX_STOCK) : null
}

/**
 * Whether a variation leaves its stock to its product, which counts one
 * (`_manage_stock` "parent", or not its own while the product's is on):
 * WooCommerce sells its variations from one pool, which has no form here,
 * so each takes the pool's count and the report says so.
 */
export const sharesParentStock = (
  meta: ReadonlyMap<string, string>,
  parent: ReadonlyMap<string, string> | undefined
): boolean => !counts(meta) && counts(parent)

/**
 * An item's stock (adr/0042 §9, Ek 2026-11-20): the count the shop kept
 * where it counted one (a variation under a counting product: the
 * product's); 0 for one shown out of stock; else `"untracked"`, as
 * WooCommerce sells an item whose stock it does not count (always
 * sellable here, whatever the business).
 */
export function stockOf(
  meta: ReadonlyMap<string, string>,
  parent?: ReadonlyMap<string, string>
): SourceStock {
  if (counts(meta)) {
    return countOf(meta)
  }
  if (parent && sharesParentStock(meta, parent)) {
    return countOf(parent)
  }
  if (meta.get("_stock_status") === "outofstock") {
    return 0
  }
  return parent?.get("_stock_status") === "outofstock" ? 0 : "untracked"
}

/** A weight in grams from WooCommerce's kg. */
export function gramsOf(text: string | undefined): number | null {
  const kg = measureOf(text)
  return kg === null ? null : Math.max(1, Math.round(kg * 1000))
}
