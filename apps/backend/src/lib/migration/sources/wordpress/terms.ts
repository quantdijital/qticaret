import { toSlug } from "../../../seo/slug"
import type { SourceBrand, SourceCategory, SourcePostTerm } from "../../types"
import type { CategoryCover, CoverOf } from "./covers"
import { bodyBlocks, plainText } from "./html"
import { entryOf, textOf, unserialize } from "./php"
import type { Wxr, WxrItem, WxrTerm } from "./reader"
import { seoFieldsOf } from "./seo"

/**
 * The export's taxonomies: product categories as paths from the top with
 * their old archive addresses, brands (WooCommerce Brands and the two
 * popular brand plugins), attribute terms by slug, blog categories and
 * tags. A category's text is its own description, else the block a
 * Flatsome theme shows under its products (`cat_meta`), as plain text.
 * A category's or a blog term's SEO title and description are the SEO
 * plugin's term meta (Rank Math's; Yoast keeps a term's in an option the
 * export does not carry); one without them takes the shop's templates,
 * as a category made in the panel does.
 */

export const BRAND_TAXONOMIES = ["product_brand", "pwb-brand", "yith_product_brand"] as const
// WooCommerce's own default category, never a shop's choice
const DEFAULT_CATEGORIES = new Set(["uncategorized", "kategorilenmemis"])
const MAX_DEPTH = 10
const MAX_CATEGORY_TEXT = 20_000
const MAX_TERM_TEXT = 1_000

/**
 * A product category with the SEO fields its SEO plugin kept on the term,
 * and its own picture where the shop gave one (`covers.ts`).
 */
export interface WordpressCategory extends SourceCategory {
  seo_title: string | null
  seo_description: string | null
  focus_keyword: string | null
  image?: CategoryCover
  /** The attachment id a picture named that the media library lacks (a note). */
  image_missing?: string
}

export interface Bases {
  category: string
  brand: string
  postCategory: string
  postTag: string
}

export class Taxonomies {
  private readonly bySlug = new Map<string, WxrTerm>()
  private readonly byId = new Map<string, WxrTerm>()
  private readonly blocks = new Map<string, WxrItem>()

  constructor(readonly wxr: Wxr) {
    for (const term of wxr.terms) {
      this.bySlug.set(`${term.taxonomy}/${term.slug}`, term)
      this.byId.set(term.id, term)
    }
    // Flatsome's saved blocks, by slug and id: a category's text may be one
    for (const item of wxr.items) {
      if (item.type === "blocks" && item.status === "publish") {
        this.blocks.set(item.slug, item)
        this.blocks.set(item.id, item)
      }
    }
  }

  term(taxonomy: string, slug: string): WxrTerm | undefined {
    return this.bySlug.get(`${taxonomy}/${slug}`)
  }

  termById(id: string): WxrTerm | undefined {
    return this.byId.get(id)
  }

  of(taxonomy: string): WxrTerm[] {
    return this.wxr.terms.filter((term) => term.taxonomy === taxonomy)
  }

  /** A hierarchical term's slugs from the top (`["mutfak", "tavalar"]`); a loop stops it. */
  slugPath(taxonomy: string, slug: string): string[] {
    const path = [slug]
    for (let parent = this.term(taxonomy, slug)?.parent ?? ""; parent !== "";) {
      if (path.includes(parent) || path.length >= MAX_DEPTH) {
        break
      }
      path.unshift(parent)
      parent = this.term(taxonomy, parent)?.parent ?? ""
    }
    return path
  }

  /** A product category's path of names; its slug as its name where the export lacks the term. */
  categoryPath(slug: string, name?: string): string[] {
    return this.slugPath("product_cat", slug).map((each) => {
      const own = this.term("product_cat", each)?.name
      if (own) {
        return own
      }
      return each === slug && name ? name : each
    })
  }

  /** A term's own text, else the Flatsome block shown with it, as plain text. */
  textOf(term: WxrTerm, max: number): string | null {
    let html = term.description
    if (html.trim() === "") {
      const meta = unserialize(term.meta.get("cat_meta") ?? "")
      const shortcode = textOf(entryOf(meta, "cat_footer")) || textOf(entryOf(meta, "cat_header"))
      const id = /\[block\s+id=["']?([^"'\]\s]+)/.exec(shortcode)?.[1]
      html = (id ? this.blocks.get(id)?.content : undefined) ?? ""
    }
    const { text } = plainText(
      bodyBlocks(html, { siteHost: this.wxr.site?.hostname ?? null }).blocks,
      max
    )
    return text === "" ? null : text
  }
}

/** The product categories, every one the export defines, parents first by path. */
export function categoriesOf(
  taxonomies: Taxonomies,
  base: string,
  used: ReadonlySet<string>,
  coverOf: (term: WxrTerm, sourceKey: string) => CoverOf = () => null
): WordpressCategory[] {
  return taxonomies
    .of("product_cat")
    .filter((term) => !DEFAULT_CATEGORIES.has(term.slug) || used.has(term.slug))
    .map((term) => {
      const slugs = taxonomies.slugPath("product_cat", term.slug)
      const seo = seoFieldsOf(term.meta, { title: term.name, site: taxonomies.wxr.siteName })
      const sourceKey = `product_cat:${term.slug}`
      return {
        ...coverOf(term, sourceKey),
        source_key: sourceKey,
        path: taxonomies.categoryPath(term.slug).map((name) => name.slice(0, 255)),
        description: taxonomies.textOf(term, MAX_CATEGORY_TEXT),
        seo_title: seo.seo_title,
        seo_description: seo.seo_description,
        focus_keyword: seo.focus_keyword,
        old_url: `${base}${slugs.join("/")}/`,
      }
    })
    .filter((category) => category.path.every((name) => name !== ""))
}

/** The brands the export defines, by whichever brand taxonomy the shop used. */
export function brandsOf(taxonomies: Taxonomies, base: string): SourceBrand[] {
  return BRAND_TAXONOMIES.flatMap((taxonomy) =>
    taxonomies
      .of(taxonomy)
      .filter((term) => term.name !== "")
      .map((term) => ({
        source_key: `${taxonomy}:${term.slug}`,
        name: term.name.slice(0, 255),
        old_url: `${base}${term.slug}/`,
      }))
  )
}

/** A blog category or tag as the post names it; null for a name no archive can have (a shortcode's debris). */
export function postTermOf(
  taxonomies: Taxonomies,
  kind: "category" | "post_tag",
  slug: string,
  name: string,
  base: string
): SourcePostTerm | null {
  const term = taxonomies.term(kind, slug)
  const own = (term?.name ?? name).trim()
  const handle = toSlug(slug) || toSlug(own)
  if (own === "" || own.length > 120 || /[[\]<>]/.test(own) || handle === "") {
    return null
  }
  const seo = term ? seoFieldsOf(term.meta, { title: own, site: taxonomies.wxr.siteName }) : null
  const description = term ? taxonomies.textOf(term, MAX_TERM_TEXT * 4) : null
  return {
    source_key: `${kind}:${slug}`,
    name: own,
    handle,
    description: description
      ? description.replace(/\s+/g, " ").slice(0, MAX_TERM_TEXT).trim()
      : null,
    seo_title: seo?.seo_title ?? null,
    seo_description: seo?.seo_description ?? null,
    old_url: `${base}${kind === "category" ? taxonomies.slugPath(kind, slug).join("/") : slug}/`,
  }
}

/** A taxonomy attribute's name from its slug (the export keeps no label): `pa_sap-rengi` → "Sap rengi". */
export function attributeLabel(taxonomy: string): string {
  const words = taxonomy.replace(/^pa_/, "").replace(/[-_]+/g, " ").trim()
  return words === "" ? taxonomy : words.charAt(0).toLocaleUpperCase("tr") + words.slice(1)
}
