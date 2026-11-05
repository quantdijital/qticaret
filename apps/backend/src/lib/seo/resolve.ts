import { summaryText } from "../catalog/summary"
import { formatLira } from "../money/format"
import { articleJsonLd, breadcrumbJsonLd, listingJsonLd, productJsonLd } from "./jsonld"
import type { ArticleFacts, JsonLd, ProductFacts } from "./jsonld"
import { listingDescription } from "./listing-description"
import { renderTemplate } from "./template"

/**
 * The `seo` object the Store API gives a page (docs/13 §1, adr/0015): the
 * storefront prints it as it is and writes no SEO logic of its own. Pure:
 * the caller loads the record, its overrides and the shop's settings.
 */

export type RobotsValue = "index,follow" | "noindex,follow" | "noindex,nofollow"
export type SeoPageKind =
  | "product"
  | "category"
  | "collection"
  | "brand"
  | "page"
  | "post"
  | "landing"
  | "post_category"
  | "post_tag"
  | "sale"

export interface SeoPayload {
  title: string
  description: string
  /** Absolute, on the shop's canonical host; null until a host is set (the storefront uses its own). */
  canonical: string | null
  robots: RobotsValue
  openGraph: {
    title: string
    description: string
    image: string | null
    imageAlt: string | null
    type: "product" | "article" | "website"
    url: string | null
    siteName: string
  }
  twitter: {
    card: "summary_large_image" | "summary"
    title: string
    description: string
    image: string | null
  }
  /** From the root down to the page itself; URLs absolute when the host is set. */
  breadcrumbs: { name: string; url: string }[]
  /** Structured data blocks (F3.12); none until the canonical host is set (they need absolute URLs). */
  jsonLd: JsonLd[]
  /** Other languages' URLs (F19). */
  hreflang: { locale: string; url: string }[]
}

export interface SeoOverrides {
  seo_title: string | null
  seo_description: string | null
  canonical_override: string | null
  robots_override: "index_follow" | "noindex_follow" | "noindex_nofollow" | null
  og_image_alt: string | null
}

export interface SeoSubject {
  kind: SeoPageKind
  /** The page's active path (`/urun/keten-gomlek`). */
  path: string
  name: string
  /** Plain text: the product's or category's description. */
  description: string
  /** Template values the caller found (kategori, marka, fiyat_cümlesi…); the name and shop are added. */
  tokens: Readonly<Record<string, string | null>>
  overrides: SeoOverrides | null
  /** The chosen share image (an override file, else the main image), if any. */
  image: { url: string; alt: string | null } | null
  /** Ancestors, root first (a product's primary category chain); the page is added last. */
  trail: { name: string; path: string }[]
  /** A product page's facts for its structured data (F3.12). */
  product?: ProductFacts | undefined
  /** A listing page's first products, for its `ItemList`. */
  listing?: { name: string; path: string }[] | undefined
  /** A content page's or blog post's facts (F3.16); the description and publisher are filled in. */
  article?: Omit<ArticleFacts, "description" | "publisher"> | undefined
  /** A product's short description's lines (adr/0055 Ek 2026-11-05): the meta's first fallback. */
  summary?: readonly string[] | undefined
}

export interface SeoShop {
  name: string
  canonicalHost: string | null
  /** False on an instance search engines must not index (staging): every page says noindex. */
  indexing: boolean
  titleTemplates: {
    product: string
    category: string
    brand: string
    page: string
    post: string
    landing: string
  }
  descriptionTemplates: { product: string }
}

// docs/13 §3: what a result shows of a description before cutting it
export const DESCRIPTION_EXCERPT = 155
// The `kısa_açıklama` token: a sentence or two of the description
export const SHORT_EXCERPT = 140

const ROBOTS: Record<NonNullable<SeoOverrides["robots_override"]>, RobotsValue> = {
  index_follow: "index,follow",
  noindex_follow: "noindex,follow",
  noindex_nofollow: "noindex,nofollow",
}

// A tag: `<` then a letter (or `/` and a letter), up to its `>`. "3 < 5" is text; no
// `<` inside, so many `<` without a `>` cost one pass, not one pass each
const TAG = /<\/?[a-z][^<>]*>/gi

/** Text as one line: tags dropped, spaces collapsed. Descriptions may hold simple HTML. */
export function plainText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(TAG, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The text cut at a word before `max` characters, without a dangling comma or joiner. */
export function excerpt(text: string, max: number): string {
  const clean = plainText(text)
  if (clean.length <= max) {
    return clean
  }
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, "")
}

/**
 * The `fiyat_cümlesi` token (docs/13 §3): "899,00 TL." for one price,
 * "899,00 TL'den başlayan fiyatlarla." for a range; nothing without one.
 */
export function priceSentence(amounts: readonly number[]): string {
  const prices = amounts.filter((amount) => Number.isFinite(amount) && amount > 0)
  if (prices.length === 0) {
    return ""
  }
  const lowest = Math.min(...prices)
  return lowest === Math.max(...prices)
    ? `${formatLira(lowest)}.`
    : `${formatLira(lowest)}'den başlayan fiyatlarla.`
}

/**
 * The `kargo_cümlesi` token (docs/13 §3, F7.8): when an order leaves, in
 * working days ("1–2 iş gününde kargoda."); "Aynı gün kargoda." for none.
 */
export function shippingSentence(handlingMin: number, handlingMax: number): string {
  if (handlingMax <= 0) {
    return "Aynı gün kargoda."
  }
  return handlingMin === handlingMax || handlingMin <= 0
    ? `${String(handlingMax)} iş gününde kargoda.`
    : `${String(handlingMin)}–${String(handlingMax)} iş gününde kargoda.`
}

function absolute(host: string | null, path: string): string | null {
  return host ? new URL(path, `https://${host}`).href : null
}

// A page's own name fills its kind's token; a collection uses the category template
const NAME_TOKEN: Record<SeoPageKind, string> = {
  product: "ürün_adı",
  category: "kategori",
  collection: "kategori",
  brand: "marka",
  page: "başlık",
  post: "başlık",
  landing: "başlık",
  post_category: "başlık",
  post_tag: "başlık",
  sale: "başlık",
}

// The sale page (`/kampanyalar`) has no template of the shop's: its name and the shop's
const SALE_TITLE = "{başlık} | {mağaza}"

// A blog archive (adr/0019 ek 2026-11-03) is titled as a post is, its name in the post's place
function templateOf(kind: SeoPageKind, shop: SeoShop): string {
  if (kind === "sale") {
    return SALE_TITLE
  }
  const own =
    kind === "collection"
      ? "category"
      : kind === "post_category" || kind === "post_tag"
        ? "post"
        : kind
  return shop.titleTemplates[own]
}

function titleOf(subject: SeoSubject, shop: SeoShop): string {
  const own = subject.overrides?.seo_title
  if (own) {
    return own
  }
  const values = { ...subject.tokens, [NAME_TOKEN[subject.kind]]: subject.name, mağaza: shop.name }
  return renderTemplate(templateOf(subject.kind, shop), values) || subject.name
}

function descriptionOf(subject: SeoSubject, shop: SeoShop): string {
  const own = subject.overrides?.seo_description
  if (own) {
    return own
  }
  if (subject.kind === "product") {
    const filled = renderTemplate(shop.descriptionTemplates.product, {
      ...subject.tokens,
      ürün_adı: subject.name,
      mağaza: shop.name,
    })
    if (filled) {
      return filled
    }
  }
  // A listing without text of its own still describes itself (docs/21 §8)
  const text =
    summaryText(subject.summary ?? [], DESCRIPTION_EXCERPT) ||
    excerpt(subject.description, DESCRIPTION_EXCERPT)
  return (
    text || excerpt(listingDescription(subject.kind, subject.name, shop.name), DESCRIPTION_EXCERPT)
  )
}

/** Builds the page's `seo` object from its record, overrides and the shop's settings. */
export function resolveSeoPayload(subject: SeoSubject, shop: SeoShop): SeoPayload {
  const title = titleOf(subject, shop)
  const description = descriptionOf(subject, shop)
  const canonical = absolute(
    shop.canonicalHost,
    subject.overrides?.canonical_override ?? subject.path
  )
  const robotsOverride = subject.overrides?.robots_override
  const image = subject.image
  const url = (path: string) => absolute(shop.canonicalHost, path) ?? path
  const breadcrumbs = [...subject.trail, { name: subject.name, path: subject.path }].map(
    (crumb) => ({ name: crumb.name, url: url(crumb.path) })
  )
  return {
    title,
    description,
    canonical,
    robots: !shop.indexing
      ? "noindex,nofollow"
      : robotsOverride
        ? ROBOTS[robotsOverride]
        : "index,follow",
    openGraph: {
      title,
      description,
      image: image?.url ?? null,
      imageAlt: image ? (subject.overrides?.og_image_alt ?? image.alt ?? subject.name) : null,
      type:
        subject.kind === "product" ? "product" : subject.kind === "post" ? "article" : "website",
      url: canonical,
      siteName: shop.name,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      image: image?.url ?? null,
    },
    breadcrumbs,
    jsonLd: canonical
      ? structuredData(subject, { description, canonical, breadcrumbs, url, shop: shop.name })
      : [],
    hreflang: [],
  }
}

interface PageFacts {
  description: string
  canonical: string
  breadcrumbs: SeoPayload["breadcrumbs"]
  url: (path: string) => string
  shop: string
}

function structuredData(
  subject: SeoSubject,
  { description, canonical, breadcrumbs, url, shop }: PageFacts
): JsonLd[] {
  const page = subject.product
    ? productJsonLd(subject.product, canonical)
    : subject.article
      ? articleJsonLd({ ...subject.article, description, publisher: shop }, canonical)
      : subject.listing
        ? listingJsonLd(
            {
              name: subject.name,
              description,
              items: subject.listing.map((item) => ({ name: item.name, url: url(item.path) })),
            },
            canonical
          )
        : null
  return [page, breadcrumbJsonLd(breadcrumbs)].filter((block): block is JsonLd => block !== null)
}
