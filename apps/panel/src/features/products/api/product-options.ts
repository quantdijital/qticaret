import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * The product's options and the variants made from them (docs/06 "Ürün
 * sayfası", "Varyantlar"). Medusa 2.16+ keeps options on their own and
 * links them to products (`POST /admin/products/:id/options/batch`,
 * `sdk.admin.product.linkOptions`): a new option is made exclusive to this
 * product, values are added to or taken from an option already linked.
 * Variants are made in one variant batch, with no price: the server keeps
 * prices, and a variant without one is shown as "Fiyat yok" until priced.
 */

export interface OptionChanges {
  /** New options with their values, made for this product only. */
  add: { title: string; values: string[] }[]
  /** Options taken off the product (none of its variants uses them). */
  remove: string[]
  /** Values added to or taken off an option already on the product. */
  update: { optionId: string; add: string[]; remove: string[] }[]
}

export interface VariantCreate {
  title: string
  /** Its value for each of the product's options, by the option's title. */
  options: Record<string, string>
  variant_rank: number
  manage_inventory: boolean
}

export interface VariantFill {
  id: string
  /** A value for an option it had none of (an option added after it was made). */
  options: Record<string, string>
}

export interface VariantPlan {
  options: OptionChanges
  /** Variants that get a value for an option added after them. */
  fill: VariantFill[]
  /** The combinations the product has no variant for yet. */
  create: VariantCreate[]
}

const hasOptionChanges = (changes: OptionChanges) =>
  changes.add.length > 0 ||
  changes.remove.length > 0 ||
  changes.update.some((each) => each.add.length > 0 || each.remove.length > 0)

/** The options first (a new variant needs its option values to exist), then the variants. */
export async function applyVariantPlan(productId: string, plan: VariantPlan): Promise<void> {
  const { options } = plan
  if (hasOptionChanges(options)) {
    await sdk.admin.product.linkOptions(productId, {
      ...(options.add.length > 0
        ? {
            add: options.add.map((option) => ({
              title: option.title,
              values: option.values,
              is_exclusive: true,
            })),
          }
        : {}),
      ...(options.remove.length > 0 ? { remove: options.remove } : {}),
      ...(options.update.length > 0
        ? {
            update: options.update.map((each) => ({
              product_option_id: each.optionId,
              add: each.add.map((value) => ({ value })),
              remove: each.remove,
            })),
          }
        : {}),
    })
  }
  if (plan.fill.length > 0 || plan.create.length > 0) {
    await sdk.admin.product.batchVariants(productId, {
      create: plan.create.map((variant) => ({
        title: variant.title,
        options: variant.options,
        variant_rank: variant.variant_rank,
        manage_inventory: variant.manage_inventory,
        allow_backorder: false,
        // No price yet: the row says "Fiyat yok" until one is given (never computed here)
        prices: [],
      })),
      update: plan.fill.map((variant) => ({ id: variant.id, options: variant.options })),
    })
  }
}

/** `applyVariantPlan` as a mutation; the product and what reads it are read again after. */
export function useApplyVariantPlan(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (plan: VariantPlan) => applyVariantPlan(productId, plan),
    // Options saved and variants refused still changed the product
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["seo"] }),
      ])
    },
  })
}
