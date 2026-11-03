import { isReservedPath, pagePath, postPath } from "../../../seo"
import { toSlug } from "../../../seo/slug"
import type { SourceContent, SourcePage, SourcePost, SourcePostTerm } from "../../types"
import type { WordpressContext } from "./context"
import { note } from "./context"
import { bodyBlocks, documentOf, plainText } from "./html"
import type { WxrItem } from "./reader"
import { cutAt, seoFieldsOf } from "./seo"
import type { Bases } from "./terms"
import { postTermOf } from "./terms"
import { oldPathOf } from "./urls"

/**
 * Blog posts and pages as content records (F3.16): the body as a checked
 * document, the excerpt, author, first publishing date, cover picture,
 * SEO fields and old address; a post with its one category (the SEO
 * plugin's primary one) and its tags. Pages that are no content page here
 * keep only their old address for the owner's decision: the shop's legal
 * texts (published from Settings > Legal, adr/0048), the shop's own pages
 * (cart, checkout, account), the front page and a page of layout alone.
 */

// As the panel tells a legal-looking title (features/content/legal-title.ts), plain letters
const LEGAL_WORDS: readonly RegExp[] = [
  /sozlesme/,
  /kvkk/,
  /aydinlatma/,
  /cerez/,
  /gizlilik/,
  /kisisel veri/,
  /on bilgilendirme/,
  /iade (ve degisim )?(politika|kosul)/,
  /iade ve degisim/,
  /kargo ve iade/,
  /(kargo|teslimat) (ve teslimat )?politika/,
  /kullanim kosul/,
  /sartlar ve kosullar/,
  /cayma/,
  /privacy|cookie policy|terms (of|and) (service|conditions)|refund policy/,
]
const SYSTEM_PAGE =
  /\[(woocommerce_cart|woocommerce_checkout|woocommerce_my_account|woocommerce_order_tracking|yith_wcwl_wishlist|ti_wishlistsview)\b/
// What a content entry keeps (workflows/content/rules CONTENT_LIMITS): longer is cut here, not refused there
const CONTENT_LIMITS = { title: 200, excerpt: 500, author: 120, imageAlt: 300 } as const
const PRIMARY_CATEGORY = ["rank_math_primary_category", "_yoast_wpseo_primary_category"]
const MAX_TAGS = 50
const ASCII: Readonly<Record<string, string>> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }

const plainWords = (text: string) =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (letter) => ASCII[letter] ?? letter)
    .replace(/[-_\s]+/g, " ")

/** Whether the page reads like one of the shop's legal texts, by its title or slug. */
export const looksLegal = (title: string, slug: string): boolean =>
  [plainWords(title), plainWords(slug)].some((text) => LEGAL_WORDS.some((word) => word.test(text)))

/** The item's text, picture and SEO fields as a content record; and what its body lost. */
function contentOf(context: WordpressContext, item: WxrItem, handle: string) {
  const body = bodyBlocks(item.content, { siteHost: context.siteHost, title: item.title })
  const { doc, cut } = documentOf(body.blocks)
  const excerpt = plainText(bodyBlocks(item.excerpt).blocks, 4 * CONTENT_LIMITS.excerpt).text
  const coverId = item.meta.get("_thumbnail_id")?.trim() ?? ""
  const cover = coverId ? context.attachments.get(coverId) : undefined
  const seo = seoFieldsOf(item.meta, { title: item.title, site: context.wxr.siteName })
  const content: SourceContent = {
    handle,
    body: doc,
    excerpt: excerpt === "" ? null : cutAt(excerpt.replace(/\s+/g, " "), CONTENT_LIMITS.excerpt),
    author: item.author ? item.author.slice(0, CONTENT_LIMITS.author) : null,
    // One the old site kept out of search (a theme's demo page, a draft text) waits for the owner here
    status: item.status === "publish" && !item.password && !seo.robots ? "published" : "draft",
    published_at: item.status === "publish" ? item.date : null,
    cover:
      cover && /^https?:\/\//i.test(cover.attachmentUrl)
        ? {
            url: cover.attachmentUrl,
            alt:
              cutAt(
                (cover.meta.get("_wp_attachment_image_alt") ?? "").replace(/\s+/g, " ").trim(),
                CONTENT_LIMITS.imageAlt
              ) || null,
          }
        : null,
    seo_title: seo.seo_title,
    seo_description: seo.seo_description,
    focus_keyword: seo.focus_keyword,
    robots: seo.robots,
  }
  return {
    content,
    images: body.images,
    widgets: body.widgets,
    cut,
    noindex: item.status === "publish" && seo.robots !== null,
  }
}

/** What a body lost, named for the report. */
function noteLosses(
  context: WordpressContext,
  kind: "post" | "page",
  key: string,
  lost: { images: number; widgets: number; cut: boolean; noindex: boolean }
) {
  if (lost.noindex) {
    note(context, kind, key, "migration.wordpress_noindex_draft")
  }
  if (lost.cut) {
    note(context, kind, key, "migration.wordpress_body_cut")
  }
  if (lost.images > 0 || lost.widgets > 0) {
    note(context, kind, key, "migration.wordpress_body_media")
  }
}

/** A blog post with its terms; null (named) for one that cannot be one here. */
export function postOf(context: WordpressContext, item: WxrItem, bases: Bases): SourcePost | null {
  const key = `post:${item.id}`
  const handle = toSlug(item.slug) || toSlug(item.title)
  if (item.title === "" || handle === "") {
    note(context, "post", key, "migration.wordpress_post_unread")
    return null
  }
  if (isReservedPath(postPath(handle))) {
    note(context, "post", key, "migration.wordpress_path_reserved")
    return null
  }
  const own = contentOf(context, item, handle)
  noteLosses(context, "post", key, own)
  const primary = PRIMARY_CATEGORY.map((meta) => item.meta.get(meta)?.trim()).find(Boolean)
  const primarySlug = primary ? context.taxonomies.termById(primary)?.slug : undefined
  const categories = item.terms.filter((term) => term.domain === "category")
  const chosen = categories.find((term) => term.slug === primarySlug) ?? categories[0]
  if (categories.length > 1) {
    note(context, "post", key, "migration.wordpress_post_categories")
  }
  const termOf = (kind: "category" | "post_tag", slug: string, name: string) => {
    const term = postTermOf(
      context.taxonomies,
      kind,
      slug,
      name,
      kind === "category" ? bases.postCategory : bases.postTag
    )
    if (!term) {
      note(
        context,
        kind === "category" ? "post_category" : "post_tag",
        `${kind}:${slug}`,
        "migration.wordpress_term_unread"
      )
    }
    return term
  }
  const tags = item.terms
    .filter((term) => term.domain === "post_tag")
    .map((term) => termOf("post_tag", term.slug, term.name))
    .filter((term): term is SourcePostTerm => term !== null)
  if (tags.length > MAX_TAGS) {
    note(context, "post", key, "migration.wordpress_post_tags_cut")
  }
  return {
    source_key: key,
    title: cutAt(item.title, CONTENT_LIMITS.title),
    content: own.content,
    category: chosen ? termOf("category", chosen.slug, chosen.name) : null,
    tags: tags.slice(0, MAX_TAGS),
    old_url: oldPathOf(item.link, context.wxr.site),
  }
}

/**
 * A page: a content page here when it is one; else only its old address,
 * named with why (or nothing at all for one without an address).
 */
export function pageOf(context: WordpressContext, item: WxrItem): SourcePage | null {
  const key = `page:${item.id}`
  const old = oldPathOf(item.link, context.wxr.site)
  const handle = toSlug(item.slug) || toSlug(item.title)
  const skip = (reason: string) => {
    note(context, "page", key, reason)
    return old ? { source_key: key, title: item.title || handle, old_url: old } : null
  }
  if (old === null && /^https?:\/\/[^/]+\/?$/i.test(item.link)) {
    return skip("migration.wordpress_page_front")
  }
  if (looksLegal(item.title, item.slug)) {
    return skip("migration.wordpress_page_legal")
  }
  if (SYSTEM_PAGE.test(item.content)) {
    return skip("migration.wordpress_page_system")
  }
  if (item.title === "" || handle === "" || isReservedPath(pagePath(handle))) {
    return skip("migration.wordpress_path_reserved")
  }
  const own = contentOf(context, item, handle)
  if (own.content.body.content.length === 0) {
    return skip("migration.wordpress_page_empty")
  }
  noteLosses(context, "page", key, own)
  return {
    source_key: key,
    title: cutAt(item.title, CONTENT_LIMITS.title),
    old_url: old ?? pagePath(handle),
    content: own.content,
  }
}
