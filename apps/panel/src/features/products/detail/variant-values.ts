import { z } from "zod"
import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"

const CURRENCY = "try"

const rowSchema = z.object({
  price: z
    .string()
    .refine((text) => (parseMoneyInput(text) ?? 0) > 0, { message: "products.errors.price" }),
  stock: z.string().refine((text) => /^\d+$/.test(text.trim()) && Number(text) <= 1_000_000, {
    message: "products.errors.stock",
  }),
  backorder: z.boolean(),
})
export const variantsSchema = z.object({ rows: z.array(rowSchema) })
export type VariantValues = z.infer<typeof variantsSchema>

export type Variant = NonNullable<ProductDetail["variants"]>[number]

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

/** The form's rows as stored: TRY price, stock at the default location, preorder. */
export function savedRows(variants: Variant[], locationId: string | null): VariantValues {
  return {
    rows: variants.map((variant) => {
      const amount = variant.prices?.find((price) => price.currency_code === CURRENCY)?.amount
      return {
        price: typeof amount === "number" ? formatMoneyInput(amount) : "",
        stock: String(levelAt(variant, locationId).stocked),
        backorder: Boolean(variant.allow_backorder),
      }
    }),
  }
}

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
    if (!row || (!priceChanged && !stockChanged && !backorderChanged)) {
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
      },
    ]
  })
}
