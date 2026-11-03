import type { WordpressProduct } from "./attributes"
import type { WordpressContext } from "./context"
import { note } from "./context"

/**
 * What a WordPress run tells beside its counts (adr/0042 Ek 2026-11-03),
 * the job's `result_summary.wordpress` the panel shows: the descriptive
 * attributes the products carry (for an attribute template), and what the
 * export holds that does not move (each also a note of the report).
 */

// Not the site's: WordPress's trash, unsaved drafts, media
export const LEFT_OUT = new Set(["trash", "auto-draft", "inherit"])

/** Records of what does not move, by kind: each counted, none as 0. */
export interface NotMoved {
  coupons: number
  menu_items: number
  product_tags: number
  blog_comments: number
}

/**
 * Both parts always: an empty list says the export has no descriptive
 * attribute (the panel reads a missing one as "see the report file").
 */
export interface WordpressSummary {
  /** By slug (`pa_renk` → `renk`, a template field's key), the most used first. */
  attributes: { key: string; name: string; products: number; values: number }[]
  not_moved: NotMoved
}

/** Menus, coupons, blog comments and product tags, counted and named in the report. */
export function notMovedOf(context: WordpressContext): NotMoved {
  const { items } = context.wxr
  const count = (type: string) =>
    items.filter((item) => item.type === type && !LEFT_OUT.has(item.status)).length
  const menus = count("nav_menu_item")
  if (menus > 0) {
    note(context, "page", `nav_menu_item: ${String(menus)} öğe`, "migration.wordpress_menus")
  }
  const coupons = count("shop_coupon")
  if (coupons > 0) {
    note(context, "product", `shop_coupon: ${String(coupons)} kupon`, "migration.wordpress_coupons")
  }
  const comments = items
    .filter((item) => item.type === "post" || item.type === "page")
    .flatMap((item) => item.comments.filter((comment) => comment.approved === "1")).length
  if (comments > 0) {
    note(context, "post", `comment: ${String(comments)} yorum`, "migration.wordpress_blog_comments")
  }
  const tags = new Map<string, number>()
  for (const item of items.filter(
    (each) => each.type === "product" && !LEFT_OUT.has(each.status)
  )) {
    for (const term of item.terms.filter((each) => each.domain === "product_tag")) {
      tags.set(term.slug, (tags.get(term.slug) ?? 0) + 1)
    }
  }
  if (tags.size > 0) {
    const once = [...tags.values()].filter((uses) => uses === 1).length
    note(
      context,
      "product",
      `product_tag: ${String(tags.size)} etiket, ${String(once)} tanesi tek üründe`,
      "migration.wordpress_product_tags"
    )
  }
  return { coupons, menu_items: menus, product_tags: tags.size, blog_comments: comments }
}

/**
 * The block: the moving products' descriptive attributes by slug (two the
 * shop keyed alike, a global and a product's own, fill the same field:
 * one entry), each with how many products have it and how many values.
 */
export function wordpressSummary(
  products: readonly WordpressProduct[],
  notMoved: NotMoved
): WordpressSummary {
  const bySlug = new Map<string, { name: string; products: number; values: Set<string> }>()
  for (const product of products) {
    for (const slug of new Set(product.attributes.map((attribute) => attribute.slug))) {
      const own = product.attributes.filter((attribute) => attribute.slug === slug)
      const entry = bySlug.get(slug) ?? {
        name: own[0]?.name ?? slug,
        products: 0,
        values: new Set(),
      }
      entry.products += 1
      own.flatMap((attribute) => attribute.values).forEach((value) => entry.values.add(value))
      bySlug.set(slug, entry)
    }
  }
  const attributes = [...bySlug]
    .map(([key, entry]) => ({
      key,
      name: entry.name,
      products: entry.products,
      values: entry.values.size,
    }))
    .sort((a, b) => b.products - a.products || a.key.localeCompare(b.key))
  return { attributes, not_moved: notMoved }
}
