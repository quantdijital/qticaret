import { SUMMARY_TEXT_MAX } from "../catalog/summary"
import { SEO_META_LIMITS } from "../seo/meta"
import { VAT_NAME_MAX } from "../tax"
import { decimalCell, handleCell, handleListCell, statusCell, stockCell, textCell } from "./cells"
import type { Cell } from "./cells"
import type { ColumnKey } from "./columns"

/** How long a cell may be, column by column (F3.9). */
export const SHEET_LIMITS = {
  title: 255,
  description: 20_000,
  option: 100,
  sku: 100,
  barcode: 64,
  attribute: 500,
} as const

const MAX_AMOUNT = 1_000_000_000
// As the product page takes a unit cost
const MAX_COST = 10_000_000

type Parse = (raw: string) => Cell<unknown>

const decimal =
  (decimals: number, key: string): Parse =>
  (raw) =>
    decimalCell(raw, { max: MAX_AMOUNT, decimals, key })

/** A product's own cells, read from its first row that fills them. */
export const PRODUCT_PARSERS: Partial<Record<ColumnKey, Parse>> = {
  title: (raw) => textCell(raw, SHEET_LIMITS.title),
  status: statusCell,
  description: (raw) => textCell(raw, SHEET_LIMITS.description, { multiline: true }),
  // Plain text, its lines kept: the short description's cap, line breaks counted too
  summary: (raw) => textCell(raw, SUMMARY_TEXT_MAX, { multiline: true }),
  categories: handleListCell,
  collection: handleCell,
  brand: handleCell,
  weight: decimal(3, "catalog_import.dimension_invalid"),
  length: decimal(3, "catalog_import.dimension_invalid"),
  width: decimal(3, "catalog_import.dimension_invalid"),
  height: decimal(3, "catalog_import.dimension_invalid"),
  seo_title: (raw) => textCell(raw, SEO_META_LIMITS.seo_title),
  seo_description: (raw) => textCell(raw, SEO_META_LIMITS.seo_description),
  focus_keyword: (raw) => textCell(raw, SEO_META_LIMITS.focus_keyword),
  template: handleCell,
  // A rate's name or percentage, matched against the shop's rates when planned (`vatRateOf`)
  vat: (raw) => textCell(raw, VAT_NAME_MAX),
}

/** A variant's cells, read from every row. */
export const VARIANT_PARSERS = {
  sku: (raw: string) => textCell(raw, SHEET_LIMITS.sku),
  barcode: (raw: string) => textCell(raw, SHEET_LIMITS.barcode),
  price: decimal(2, "catalog_import.price_invalid"),
  cost: (raw: string) =>
    decimalCell(raw, { max: MAX_COST, decimals: 2, key: "catalog_import.cost_invalid" }),
  // A quantity, or `Takipsiz`: not counted, always sellable (adr/0018 Ek 2026-11-20)
  stock: (raw: string) => stockCell(raw, MAX_AMOUNT),
} as const
