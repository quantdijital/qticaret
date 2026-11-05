import type { ProductCatalog, VariantCodes } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { gtinProblem, normalizeGtin } from "@/lib/gtin"

/**
 * A variant's identifiers as structured data and the shopping feeds read
 * them (docs/13 §5, docs/14 P-DATA-02): its stock code (SKU), its barcode
 * (GTIN) in Medusa's `ean`, `upc` or `barcode`, and its manufacturer part
 * number (MPN), which the catalog keeps beside the variant.
 */

type Variant = NonNullable<ProductDetail["variants"]>[number]
export type CatalogVariant = ProductCatalog["variants"][number]

const GTIN_FIELDS = ["ean", "upc", "barcode"] as const
export type GtinField = (typeof GTIN_FIELDS)[number]

// Google's limit for `mpn`, as the backend checks it
export const MPN_MAX = 70
export const SKU_MAX = 64

const isGtin = (code: string) => /^\d+$/.test(code) && gtinProblem(code) === null

/**
 * Where the variant's barcode is kept: the field holding the GTIN that
 * structured data uses (the first valid of `ean`, `upc`, `barcode`, as the
 * backend reads it), so a correction lands where it is; else `ean`. An
 * in-house code in `barcode` is not a GTIN and is left alone.
 */
export function gtinField(variant: Variant): GtinField {
  return GTIN_FIELDS.find((field) => isGtin(variant[field]?.trim() ?? "")) ?? "ean"
}

/** The form's code fields as stored. */
export function savedCodes(variant: Variant, catalog: CatalogVariant | undefined) {
  return {
    sku: variant.sku ?? "",
    gtin: variant[gtinField(variant)] ?? "",
    mpn: catalog?.mpn ?? "",
  }
}

export interface CodeRow {
  sku: string
  gtin: string
  mpn: string
}

/**
 * A typed barcode that is not a GTIN, as an i18n key; a code already
 * stored is not refused (a shop may keep an in-house one there), it is
 * only pointed out (`storedGtinNote`).
 */
export function typedGtinError(row: CodeRow, saved: CodeRow | undefined): string | null {
  const problem = gtinProblem(row.gtin)
  const stored = normalizeGtin(row.gtin) === normalizeGtin(saved?.gtin ?? "")
  return problem && !stored ? `products.errors.gtin.${problem}` : null
}

/** A stored barcode that structured data cannot use, as an i18n key; nothing to fix by force. */
export function storedGtinNote(row: CodeRow, saved: CodeRow | undefined): string | null {
  const problem = gtinProblem(row.gtin)
  const stored = normalizeGtin(row.gtin) === normalizeGtin(saved?.gtin ?? "")
  return problem && stored ? `products.detail.codes.stored.${problem}` : null
}

/** What to send of a variant's codes; only the changed ones, an emptied one as cleared. */
export function codeEdits(
  variant: Variant,
  row: CodeRow,
  changed: { sku?: boolean; gtin?: boolean; mpn?: boolean } | undefined
): { codes: VariantCodes | null; mpn?: string | null } {
  const codes: VariantCodes = {
    ...(changed?.sku ? { sku: row.sku.trim() || null } : {}),
    ...(changed?.gtin ? { [gtinField(variant)]: normalizeGtin(row.gtin) || null } : {}),
  }
  return {
    codes: Object.keys(codes).length > 0 ? codes : null,
    ...(changed?.mpn ? { mpn: row.mpn.trim() || null } : {}),
  }
}

/**
 * The variant the advisor's "barcode missing" finding sends the person to:
 * the first without a valid barcode or an MPN, else the first without a
 * valid barcode, else the first.
 */
export function firstUncoded(rows: readonly CodeRow[]): number {
  const noGtin = (row: CodeRow) => row.gtin.trim() === "" || gtinProblem(row.gtin) !== null
  const bare = rows.findIndex((row) => noGtin(row) && row.mpn.trim() === "")
  const index = bare === -1 ? rows.findIndex(noGtin) : bare
  return Math.max(index, 0)
}
