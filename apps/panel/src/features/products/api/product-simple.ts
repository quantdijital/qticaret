import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * Making a product with variants a simple one (docs/06 "Ürün sayfası",
 * "Ürün verileri"): one variant stays, its price, stock and codes kept.
 */
export interface SimplePlan {
  /** The variants deleted (every one but the kept). */
  remove: string[]
  /** The options a shopper picks, taken off the product. */
  options: string[]
}

/**
 * Two Medusa workflows, each whole or nothing: the other variants are
 * deleted first (`POST /admin/products/:id/variants/batch`, `delete`;
 * order lines keep their own copy), then the options are unlinked
 * (`POST /admin/products/:id/options/batch`, `remove`; Medusa 2.22 strips
 * their values off the kept variant and drops an option made for this
 * product only). Options go only once the deletes went through: a failure
 * between leaves one variant with its options, a product with variants
 * the person may try again.
 */
export async function makeSimple(productId: string, plan: SimplePlan): Promise<void> {
  if (plan.remove.length > 0) {
    await sdk.admin.product.batchVariants(productId, { delete: plan.remove })
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
    // Deleted variants stay deleted when the options were refused
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["seo"] }),
      ])
    },
  })
}
