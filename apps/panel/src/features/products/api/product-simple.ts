import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * Making a product with variants a simple one (docs/06 "Ürün sayfası",
 * "Ürün verileri"): one variant stays, its price, stock and codes kept,
 * and the product ends with the wizard's placeholder option ("Seçenek:
 * Standart"), as a product made in the wizard or the import has.
 */
export interface SimplePlan {
  /** The variant that stays. */
  keep: string
  /** The variants deleted (every one but the kept). */
  remove: string[]
  /** The placeholder option to add, when the product has none yet. */
  add: { title: string; value: string } | null
  /**
   * The kept variant's value for every option it has once the placeholder
   * is added (Medusa wants one for each), by the option's title; null when
   * no value is to be set.
   */
  values: Record<string, string> | null
  /** The options a shopper picks, taken off the product last. */
  options: string[]
}

/**
 * Medusa workflows one after another, each whole or nothing, ordered so a
 * failure at any step leaves a product with variants (one of its options
 * still a real one) that the person may make simple again:
 *
 * 1. the other variants are deleted (`POST /admin/products/:id/variants/batch`,
 *    `delete`; order lines keep their own copy);
 * 2. the placeholder option is added (`POST /admin/products/:id/options/batch`,
 *    `add`, made for this product only);
 * 3. the kept variant gets its value (the variant batch, `update` with every
 *    option's value: Medusa 2.22 wants one for each option of the product);
 * 4. the real options are taken off (the options batch, `remove`; Medusa
 *    strips their values off the variant and drops an option made for this
 *    product only).
 */
export async function makeSimple(productId: string, plan: SimplePlan): Promise<void> {
  if (plan.remove.length > 0) {
    await sdk.admin.product.batchVariants(productId, { delete: plan.remove })
  }
  if (plan.add) {
    await sdk.admin.product.linkOptions(productId, {
      add: [{ title: plan.add.title, values: [plan.add.value], is_exclusive: true }],
    })
  }
  if (plan.values) {
    await sdk.admin.product.batchVariants(productId, {
      update: [{ id: plan.keep, options: plan.values }],
    })
  }
  if (plan.options.length > 0) {
    await sdk.admin.product.linkOptions(productId, { remove: plan.options })
  }
}

/** `makeSimple` as a mutation; the product and what reads it are read again after. */
export function useMakeSimple(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (plan: SimplePlan) => makeSimple(productId, plan),
    // A step that went through stays: the card asks again from what is stored
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["seo"] }),
      ])
    },
  })
}
