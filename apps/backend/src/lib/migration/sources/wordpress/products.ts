import { toSlug } from "../../../seo/slug"
import { descriptionOf } from "../../description"
import type { SourceVariant } from "../../types"
import type { WordpressProduct } from "./attributes"
import { descriptiveAttributes } from "./attributes"
import type { WordpressContext } from "./context"
import { measureOf, note } from "./context"
import { summaryFromExcerpt } from "./excerpt"
import type { WxrItem } from "./reader"
import { seoFieldsOf } from "./seo"
import { BRAND_TAXONOMIES } from "./terms"
import { oldPathOf } from "./urls"
import type { Attribute } from "./variations"
import { attributesOf, simpleVariant, variantsOf } from "./variations"

/**
 * WooCommerce products as the common records: live when published and
 * not hidden from the shop, else drafts; the trash is left out. Its
 * categories (the SEO plugin's primary one first), brand, SEO fields,
 * pictures (the main one, the gallery, the variations' own, with their
 * alt texts), the body as a content document (adr/0055), the excerpt as
 * the short description (adr/0055 Ek 2026-11-05; the body too when there is
 * none), options and variants, descriptive attributes (for the
 * shop's attribute template), measures and old address. Grouped
 * and external products sell nothing of their own: left out, named.
 */

const MAX_IMAGES = 50
const MAX_ALT = 300
const PRIMARY_CATEGORY = ["rank_math_primary_product_cat", "_yoast_wpseo_primary_product_cat"]
const PRIMARY_BRAND = ["rank_math_primary_product_brand"]

/** Each attribute the shop described products with, but not by: for the attribute template. */
export interface AttributeUse {
  name: string
  products: number
  values: Set<string>
}

const keyOf = (item: WxrItem) => `product:${item.id}`

/** Hidden from the catalogue and from search alike: no page anyone reaches. */
function hidden(item: WxrItem): boolean {
  const visibility = new Set(
    item.terms.filter((term) => term.domain === "product_visibility").map((term) => term.slug)
  )
  return (
    (visibility.has("exclude-from-catalog") && visibility.has("exclude-from-search")) ||
    item.meta.get("_visibility") === "hidden"
  )
}

/** Terms of one taxonomy on the item, the one its SEO plugin calls primary first. */
function ordered(
  context: WordpressContext,
  item: WxrItem,
  domains: readonly string[],
  primary: readonly string[]
) {
  const terms = item.terms.filter((term) => domains.includes(term.domain))
  const id = primary.map((key) => item.meta.get(key)?.trim()).find(Boolean)
  const first = id ? context.taxonomies.termById(id)?.slug : undefined
  return [
    ...terms.filter((term) => term.slug === first),
    ...terms.filter((term) => term.slug !== first),
  ]
}

/** Pictures by attachment id, deduplicated, in order; ones not in the media library named. */
function imagesOf(context: WordpressContext, item: WxrItem, ids: readonly string[]) {
  const images: string[] = []
  const alts: Record<string, string> = {}
  for (const id of ids) {
    const attachment = context.attachments.get(id)
    const url = attachment?.attachmentUrl ?? ""
    if (!attachment || !/^https?:\/\//i.test(url)) {
      note(context, "image", `${keyOf(item)} #${id}`, "migration.wordpress_image_missing")
      continue
    }
    if (images.includes(url) || images.length >= MAX_IMAGES) {
      continue
    }
    images.push(url)
    const alt = (attachment.meta.get("_wp_attachment_image_alt") ?? "").replace(/\s+/g, " ").trim()
    if (alt !== "") {
      alts[url] = alt.slice(0, MAX_ALT)
    }
  }
  return { images, alts }
}

function dimensionsOf(items: readonly WxrItem[]) {
  for (const item of items) {
    const [length, width, height] = ["_length", "_width", "_height"].map((key) =>
      measureOf(item.meta.get(key))
    )
    if (length && width && height) {
      return { length, width, height }
    }
  }
  return null
}

/** A product as the common record; null (named) for one that cannot move. */
export function productOf(
  context: WordpressContext,
  item: WxrItem,
  uses: Map<string, AttributeUse>
): WordpressProduct | null {
  const key = keyOf(item)
  const type = item.terms.find((term) => term.domain === "product_type")?.slug ?? "simple"
  if (type === "grouped" || type === "external") {
    note(context, "product", key, "migration.wordpress_product_type")
    return null
  }
  const handle = toSlug(item.slug) || toSlug(item.title)
  if (item.title === "" || handle === "") {
    note(context, "product", key, "migration.wordpress_product_unread")
    return null
  }
  const attributes = attributesOf(item)
  if (attributes === null) {
    note(context, "product", key, "migration.wordpress_attributes_unread")
  }
  countUses(uses, attributes ?? [])
  const plan =
    type === "variable"
      ? variantsOf(context, item, key, attributes)
      : {
          options: [],
          variants: [simpleVariant(item, `variant:${item.id}`)].filter(
            (v): v is SourceVariant => v !== null
          ),
        }
  if (plan.variants.length === 0) {
    note(context, "product", key, "migration.wordpress_product_no_price")
    return null
  }
  const variations = context.variations.get(item.id) ?? []
  const { images, alts } = imagesOf(
    context,
    item,
    [
      item.meta.get("_thumbnail_id") ?? "",
      ...(item.meta.get("_product_image_gallery") ?? "").split(","),
      ...variations.map((variation) => variation.meta.get("_thumbnail_id") ?? ""),
    ]
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id) && id !== "0")
  )
  const description = descriptionOf(item.content.trim() === "" ? item.excerpt : item.content, {
    siteHost: context.siteHost,
    title: item.title,
  })
  if (description.cut) {
    note(context, "product", key, "migration.wordpress_description_cut")
  }
  // adr/0055 Ek 2026-11-05: the excerpt is the short description too, whatever the body
  const summary = summaryFromExcerpt(item.excerpt, {
    siteHost: context.siteHost,
    title: item.title,
  })
  if (summary?.partial) {
    note(context, "product", key, "migration.wordpress_summary_partial")
  }
  const categories = ordered(context, item, ["product_cat"], PRIMARY_CATEGORY).map((term) =>
    context.taxonomies.categoryPath(term.slug, term.name)
  )
  const brand = ordered(context, item, BRAND_TAXONOMIES, PRIMARY_BRAND)[0]
  const seo = seoFieldsOf(item.meta, { title: item.title, site: context.wxr.siteName })
  return {
    source_key: key,
    handle,
    title: item.title.slice(0, 255),
    description: description.text,
    description_doc: description.doc,
    summary: summary?.lines ?? null,
    status: item.status === "publish" && !hidden(item) && !item.password ? "published" : "draft",
    categories: categories.slice(0, 20),
    brand: brand ? (context.taxonomies.term(brand.domain, brand.slug)?.name ?? brand.name) : null,
    seo_title: seo.seo_title,
    seo_description: seo.seo_description,
    focus_keyword: seo.focus_keyword,
    images,
    image_alts: alts,
    options: plan.options,
    variants: plan.variants,
    attributes: descriptiveAttributes(attributes ?? []),
    dimensions: dimensionsOf([item, ...variations]),
    old_url: oldPathOf(item.link, context.wxr.site),
  }
}

function countUses(uses: Map<string, AttributeUse>, attributes: readonly Attribute[]) {
  for (const attribute of attributes.filter((each) => !each.variation)) {
    const use = uses.get(attribute.key) ?? { name: attribute.name, products: 0, values: new Set() }
    use.products += 1
    for (const value of attribute.values) {
      use.values.add(value)
    }
    uses.set(attribute.key, use)
  }
}
