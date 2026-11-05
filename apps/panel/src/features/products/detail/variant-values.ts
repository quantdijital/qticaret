import type { UseFormReturn } from "react-hook-form"
import { z } from "zod"
import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"
import { codeEdits, MPN_MAX, savedCodes, SKU_MAX, typedGtinError } from "./variant-codes"
import type { CatalogVariant } from "./variant-codes"

const CURRENCY = "try"
const MAX_COST = 10_000_000

const rowSchema = z.object({
  price: z
    .string()
    .refine((text) => (parseMoneyInput(text) ?? 0) > 0, { message: "products.errors.price" }),
  stock: z.string().refine((text) => /^\d+$/.test(text.trim()) && Number(text) <= 1_000_000, {
    message: "products.errors.stock",
  }),
  backorder: z.boolean(),
  // Unit cost, VAT excluded (F11.4): empty means not entered
  cost: z.string().refine(
    (text) => {
      if (text.trim() === "") {
        return true
      }
      const value = parseMoneyInput(text)
      return value !== null && value >= 0 && value <= MAX_COST
    },
    { message: "products.errors.cost" }
  ),
  // The identifiers (variant-codes.ts): all may be empty; a typed barcode is checked below
  sku: z.string().trim().max(SKU_MAX, { message: "products.errors.sku" }),
  gtin: z.string(),
  mpn: z.string().trim().max(MPN_MAX, { message: "products.errors.mpn" }),
})
const variantsSchema = z.object({ rows: z.array(rowSchema) })
export type VariantValues = z.infer<typeof variantsSchema>

/**
 * The rows' rules against what is stored: a barcode typed here must be a
 * GTIN (its check digit fits); one already stored is not refused, so an
 * in-house code never holds up a price change.
 */
export function variantsSchemaFor(saved: VariantValues) {
  return variantsSchema.superRefine((values, ctx) => {
    values.rows.forEach((row, index) => {
      const message = typedGtinError(row, saved.rows[index])
      if (message) {
        ctx.addIssue({ code: "custom", path: ["rows", index, "gtin"], message })
      }
    })
  })
}

export type Variant = NonNullable<ProductDetail["variants"]>[number]

/** A row's fields in the order its refused values are told: the prices view's, then the codes'. */
export const ROW_FIELDS = ["price", "cost", "stock", "sku", "gtin", "mpn"] as const

/** The row's first refused value, as an i18n key, whichever view its field is in. */
export function rowError(form: UseFormReturn<VariantValues>, index: number): string | undefined {
  const errors = form.formState.errors.rows?.[index]
  return ROW_FIELDS.map((field) => errors?.[field]?.message).find(Boolean)
}

/** The variant's level at the shop's default location: what is on the shelf, what is held for orders. */
export function levelAt(variant: Variant, locationId: string | null) {
  const item = variant.inventory_items?.[0]
  const level = item?.inventory?.location_levels?.find((row) => row.location_id === locationId)
  return {
    inventoryItemId: item?.inventory_item_id ?? null,
    stocked: level?.stocked_quantity ?? 0,
    reserved: level?.reserved_quantity ?? 0,
    hasLevel: Boolean(level),
  }
}

/**
 * The form's rows as stored: TRY price, stock at the default location,
 * preorder, and from the catalog the unit cost and MPN; the codes.
 */
export function savedRows(
  variants: Variant[],
  locationId: string | null,
  catalog: ReadonlyMap<string, CatalogVariant> = new Map()
): VariantValues {
  return {
    rows: variants.map((variant) => {
      const amount = variant.prices?.find((price) => price.currency_code === CURRENCY)?.amount
      return {
        price: typeof amount === "number" ? formatMoneyInput(amount) : "",
        stock: String(levelAt(variant, locationId).stocked),
        backorder: Boolean(variant.allow_backorder),
        cost: costInput(catalog.get(variant.id)?.cost ?? null),
        ...savedCodes(variant, catalog.get(variant.id)),
      }
    }),
  }
}

const costInput = (cost: number | null) => (cost === null ? "" : formatMoneyInput(cost))

type DirtyRows = (Partial<Record<keyof VariantValues["rows"][number], boolean>> | undefined)[]

/**
 * What to save: only what was changed is sent, so an untouched stock is
 * never written back over a newer one.
 */
export function variantEdits(
  variants: Variant[],
  values: VariantValues,
  dirty: DirtyRows | undefined,
  locationId: string | null
): VariantEdit[] {
  return variants.flatMap((variant, index) => {
    const row = values.rows[index]
    const changed = dirty?.[index]
    const priceChanged = Boolean(changed?.price)
    const stockChanged = Boolean(changed?.stock) && locationId !== null
    const backorderChanged = Boolean(changed?.backorder)
    const costChanged = Boolean(changed?.cost)
    if (!row) {
      return []
    }
    const { codes, ...mpn } = codeEdits(variant, row, changed)
    if (
      !priceChanged &&
      !stockChanged &&
      !backorderChanged &&
      !costChanged &&
      !codes &&
      !("mpn" in mpn)
    ) {
      return []
    }
    const level = levelAt(variant, locationId)
    return [
      {
        variantId: variant.id,
        prices: (variant.prices ?? []).map(({ id, currency_code, amount }) => ({
          id,
          currency_code,
          amount,
        })),
        amount: priceChanged ? (parseMoneyInput(row.price) ?? 0) : null,
        stock:
          stockChanged && variant.manage_inventory && level.inventoryItemId
            ? {
                inventoryItemId: level.inventoryItemId,
                quantity: Number(row.stock),
                hasLevel: level.hasLevel,
              }
            : null,
        backorder: backorderChanged ? row.backorder : null,
        ...(costChanged ? { cost: parseMoneyInput(row.cost) } : {}),
        codes,
        ...mpn,
      },
    ]
  })
}
