import { z } from "@medusajs/framework/zod"

/**
 * A product's linked products (S3, WooCommerce's "Linked Products"):
 * - `upsell`: better or similar ones, shown on its page in place of the
 *   storefront's "similar products" of its category;
 * - `cross_sell`: ones bought with it, offered in the cart.
 * Each is an ordered list the shop arranges, of at most twelve. No
 * foreign key holds them: a product deleted or unpublished since is
 * skipped as they are read (`workflows/catalog/linked-products-read`) and
 * dropped from the list the next time it is saved.
 */
export const LINKED_KINDS = ["upsell", "cross_sell"] as const
export type LinkedKind = (typeof LINKED_KINDS)[number]

/** At most this many of each kind on a product, and in one answer. */
export const MAX_LINKED_PRODUCTS = 12

/** The extension's column holding each kind. */
export const LINKED_COLUMNS = {
  upsell: "upsell_product_ids",
  cross_sell: "cross_sell_product_ids",
} as const satisfies Record<LinkedKind, string>

const productId = z.string().regex(/^prod_[0-9A-Za-z]{1,64}$/)

/** One list as the admin sends it: product ids in order, each once. */
export const linkedProductIdsInput = z
  .array(productId)
  .max(MAX_LINKED_PRODUCTS)
  .refine((ids) => new Set(ids).size === ids.length, { message: "catalog.linked_duplicate" })

/** A stored list as it reads: anything not a list of strings is none. */
export const storedLinkedIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []

/**
 * The ids several products link to, in order: the first product's list,
 * then what the next adds, each once, none of the products themselves.
 * The cart's cross-sells read the lines' products this way.
 */
export function mergeLinked(
  lists: readonly (readonly string[])[],
  exclude: ReadonlySet<string>
): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const list of lists) {
    for (const id of list) {
      if (!exclude.has(id) && !seen.has(id)) {
        seen.add(id)
        merged.push(id)
      }
    }
  }
  return merged
}
