import type { MedusaContainer } from "@medusajs/framework/types"
import { landingRobots } from "../../lib/content/originality"
import type { SeoOverrides, SeoSubject } from "../../lib/seo/resolve"
import { fillShopText } from "../../lib/shop/tokens"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { authorsByIds } from "../content/author-reads"
import { livePostsOfTerm } from "../content/term-reads"
import { personOf } from "./payload-author"
import { shopInfoValues } from "../shop/info-values"
import { SEO_FIELDS, imageOf, listingItems, rowOf, trailOf } from "./payload-sources"
import type { CategoryRow, SeoMetaRow } from "./payload-sources"

interface ContentRow {
  id: string
  kind: "page" | "post"
  title: string
  excerpt?: string | null
  body_summary: string
  author_name?: string | null
  author_id?: string | null
  image_url?: string | null
  image_alt?: string | null
  published_at?: string | Date | null
  revised_at?: string | Date | null
  seo_meta?: SeoMetaRow | null
}

const iso = (value: string | Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

// Blog posts sit under the blog's own page (docs/13 §2.2), which the storefront serves;
// its name follows the shop's language once there are more (F19)
const BLOG_TRAIL = [{ name: "Blog", path: "/blog" }]

// A page with no SEO fields of its own, when the server sets one for it
const NO_OVERRIDES: SeoOverrides = {
  seo_title: null,
  seo_description: null,
  canonical_override: null,
  robots_override: null,
  og_image_alt: null,
}

/**
 * A content page's or blog post's subject (F3.16): described by its own
 * summary, else its opening text; shared with its own image, else its
 * cover; a post is an article with its author and dates.
 */
export async function contentSubject(
  container: MedusaContainer,
  id: string,
  path: string
): Promise<SeoSubject | null> {
  const entry = await rowOf<ContentRow>(
    container,
    "content_entry",
    [
      "id",
      "kind",
      "title",
      "excerpt",
      "body_summary",
      "author_name",
      "author_id",
      "image_url",
      "image_alt",
      "published_at",
      "revised_at",
      ...SEO_FIELDS,
    ],
    id
  )
  if (!entry) {
    return null
  }
  const [image, authors] = await Promise.all([
    imageOf(
      container,
      entry.seo_meta,
      entry.image_url ? { url: entry.image_url, alt: entry.image_alt ?? null } : null
    ),
    authorsByIds(container, [entry.kind === "post" ? entry.author_id : null]),
  ])
  const author = entry.author_id ? authors.get(entry.author_id) : undefined
  return {
    kind: entry.kind,
    path,
    name: entry.title,
    // The shop's details stand where the text names them (adr/0048)
    description: fillShopText(entry.excerpt ?? entry.body_summary, await shopInfoValues(container)),
    tokens: {},
    overrides: entry.seo_meta ?? null,
    image,
    trail: entry.kind === "post" ? BLOG_TRAIL : [],
    article: {
      type: entry.kind === "post" ? "BlogPosting" : "WebPage",
      headline: entry.title,
      datePublished: iso(entry.published_at),
      dateModified: iso(entry.revised_at),
      // The author's record (adr/0060), else the name a post had before authors had records
      author: author ? personOf(author) : (entry.author_name ?? null),
      image: image?.url ?? null,
    },
  }
}

interface LandingRow {
  id: string
  title: string
  category_id: string
  body_summary: string
  originality: number
  seo_meta?: SeoMetaRow | null
}

/**
 * A facet landing page's subject (F3.16, docs/13 §7): a listing of its
 * products under its category's trail, described by its own text, its
 * category name at hand for the title template. Under 30% of its own
 * text it is served `noindex,follow` until it is more original
 * (adr/0019 Ek 2026-11-05); above, the page's own robots value.
 */
export async function landingSubject(
  container: MedusaContainer,
  id: string,
  path: string
): Promise<SeoSubject | null> {
  const landing = await rowOf<LandingRow>(
    container,
    "landing_page",
    ["id", "title", "category_id", "body_summary", "originality", ...SEO_FIELDS],
    id
  )
  if (!landing) {
    return null
  }
  const own = landing.seo_meta ?? null
  const robots = landingRobots(landing.originality, own?.robots_override ?? null)
  const category = await rowOf<CategoryRow>(
    container,
    "product_category",
    ["id", "name", "mpath"],
    landing.category_id
  )
  return {
    kind: "landing",
    path,
    name: landing.title,
    description: fillShopText(landing.body_summary, await shopInfoValues(container)),
    tokens: { kategori: category?.name ?? null },
    overrides:
      robots === (own?.robots_override ?? null)
        ? own
        : { ...(own ?? NO_OVERRIDES), robots_override: robots },
    image: await imageOf(container, landing.seo_meta, null),
    trail: category ? await trailOf(container, category, true) : [],
    listing: await listingItems(container, {
      entity_type: CATALOG_ENTITY_TYPES.landing,
      entity_id: id,
    }),
  }
}

interface TermRow {
  id: string
  kind: "category" | "tag"
  name: string
  description?: string | null
  seo_meta?: SeoMetaRow | null
}

// An archive with no text of its own is described by its newest posts' titles
const DESCRIBING_POSTS = 5

/**
 * A blog category's or tag's archive (adr/0019 ek 2026-11-03): titled as a
 * post is, described by its own text or its newest posts, under the blog.
 * The storefront lists the posts itself; an archive with no live post is
 * nobody's search result (noindex, its links followed).
 */
export async function termSubject(
  container: MedusaContainer,
  id: string,
  path: string
): Promise<SeoSubject | null> {
  const term = await rowOf<TermRow>(
    container,
    "content_term",
    ["id", "kind", "name", "description", ...SEO_FIELDS],
    id
  )
  if (!term) {
    return null
  }
  const posts = await livePostsOfTerm(container, id, DESCRIBING_POSTS)
  const own = term.seo_meta ?? null
  // A term's description is stored trimmed, or null
  const description =
    term.description ??
    (posts.titles.length > 0 ? `${term.name} yazıları: ${posts.titles.join(", ")}.` : "")
  return {
    kind: term.kind === "category" ? "post_category" : "post_tag",
    path,
    name: term.name,
    description,
    tokens: {},
    overrides:
      posts.count === 0 ? { ...(own ?? NO_OVERRIDES), robots_override: "noindex_follow" } : own,
    image: await imageOf(container, own, null),
    trail: BLOG_TRAIL,
  }
}
