import type { RequestPath } from "../redirects"
import type { LegacyAddress } from "./types"

/**
 * A WordPress + WooCommerce site's own addresses (adr/0059), whatever the
 * shop sold: what WordPress serves besides its records' permalinks. The
 * English slugs are WordPress's and WooCommerce's defaults, the Turkish
 * ones their Turkish translation's. Paths come normalised (lower case, no
 * trailing slash, `parseRequestPath`). Only what no record and no rule
 * answered reaches here: a shop's own page is never shadowed.
 */

// The storefront's pages the old site's pages became
const BLOG = "/blog"
const CART = "/sepet"
const SHOP = "/magaza"
const ACCOUNT = "/hesap"
const ORDERS = "/hesap/siparisler"

// A list's page number: as a listing reads one (`sayfa`, at most 10,000)
const PAGE_NUMBER = /^[1-9]\d{0,4}$/
const RECORD_ID = /^[1-9]\d{0,11}$/
// A decoded slug: letters (Turkish ones too), digits and hyphens
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u
const FEED_FORMATS = new Set(["rss", "rss2", "atom", "rdf"])

/** The query parameters WordPress and WooCommerce read; a redirect drops them, keeps the rest. */
const WORDPRESS_KEYS = new Set([
  "p",
  "page_id",
  "post",
  "paged",
  "product-page",
  "product",
  "product_cat",
  "product_tag",
  "tag",
  "category_name",
  "cat",
  "s",
  "post_type",
  "attachment_id",
  "feed",
  "m",
  "author",
  "year",
  "monthnum",
  "day",
  "w",
  "name",
  "pagename",
  "orderby",
  "order",
  "min_price",
  "max_price",
  "rating_filter",
  "add-to-cart",
  "replytocom",
  "preview",
  "preview_id",
  "preview_nonce",
  "amp",
])
const WORDPRESS_PREFIXES = ["filter_", "query_type_"]

const isWordpressKey = (key: string): boolean =>
  WORDPRESS_KEYS.has(key) || WORDPRESS_PREFIXES.some((prefix) => key.startsWith(prefix))

/** The request's own parameters (`utm_source`), WordPress's left out. */
export function keptQuery(query: URLSearchParams): URLSearchParams {
  return new URLSearchParams([...query].filter(([key]) => !isWordpressKey(key)))
}

// WooCommerce's account endpoints, English and Turkish, by the page that took their place
const ACCOUNT_PAGES: Readonly<Record<string, string>> = {
  orders: ORDERS,
  "view-order": ORDERS,
  siparisler: ORDERS,
  siparislerim: ORDERS,
  "siparis-goruntule": ORDERS,
  "edit-address": "/hesap/adresler",
  adresler: "/hesap/adresler",
  adreslerim: "/hesap/adresler",
  "edit-account": "/hesap/bilgiler",
  "hesap-detaylari": "/hesap/bilgiler",
  "lost-password": "/hesap/sifre-sifirla",
  "kayip-parola": "/hesap/sifre-sifirla",
  wishlist: "/hesap/favoriler",
  favorilerim: "/hesap/favoriler",
}

/** WooCommerce's own pages (cart, checkout, account, shop, wish list) by their first segment. */
function storePage(segments: readonly string[]): string | null {
  const [first = "", second = ""] = segments
  switch (first) {
    case "cart":
    case "sepetim":
      return CART
    case "checkout":
    case "kasa":
      // The thank-you page (`/checkout/order-received/123`) became the order list
      return second === "order-received" || second === "siparis-alindi" ? ORDERS : CART
    case "my-account":
    case "hesabim":
      return (Object.hasOwn(ACCOUNT_PAGES, second) ? ACCOUNT_PAGES[second] : undefined) ?? ACCOUNT
    case "shop":
      return SHOP
    case "wishlist":
    case "istek-listesi":
    case "favorilerim":
      return "/hesap/favoriler"
    default:
      return null
  }
}

const isYear = (segment: string) => /^(?:19|20)\d\d$/.test(segment)
const isMonth = (segment: string) => /^(?:0[1-9]|1[0-2])$/.test(segment)
const isDay = (segment: string) => /^(?:0[1-9]|[12]\d|3[01])$/.test(segment)

/** `/2024`, `/2024/05`, `/2024/05/12`: the blog's posts of a year, a month or a day. */
const isDateArchive = (segments: readonly string[]): boolean => {
  const [year = "", month, day] = segments
  return (
    segments.length <= 3 &&
    isYear(year) &&
    (month === undefined || isMonth(month)) &&
    (day === undefined || isDay(day))
  )
}

/** A feed anywhere (`/feed`, `/comments/feed`, `/x/feed/atom`). */
const isFeed = (segments: readonly string[]): boolean => {
  const at = segments.lastIndexOf("feed")
  const rest = at === -1 ? [] : segments.slice(at + 1)
  return at !== -1 && (rest.length === 0 || (rest.length === 1 && FEED_FORMATS.has(rest[0] ?? "")))
}

/** WordPress's machinery: its admin, login, XML-RPC, REST API, theme and plugin files. */
const isMachinery = (segments: readonly string[]): boolean => {
  const [first = ""] = segments
  return (
    ["wp-admin", "wp-includes", "wp-json", "wp-content"].includes(first) ||
    (segments.length === 1 && (/^wp-[a-z-]+\.php$/.test(first) || first === "xmlrpc.php"))
  )
}

const pathOf = (segments: readonly string[]) => `/${segments.join("/")}`

/** A numbered page: `…/page/2` (its list without it) or `…/comment-page-2` (the post itself). */
function pagedPath(segments: readonly string[]): { base: string; page: number } | null {
  const last = segments.at(-1) ?? ""
  if (segments.at(-2) === "page" && PAGE_NUMBER.test(last)) {
    return { base: pathOf(segments.slice(0, -2)), page: Number(last) }
  }
  if (/^comment-page-\d{1,5}$/.test(last) && segments.length > 1) {
    return { base: pathOf(segments.slice(0, -1)), page: 1 }
  }
  return null
}

/** The address's path classes; null when it is none of WordPress's. */
function pathAddress(path: string): LegacyAddress | null {
  const segments = path.split("/").slice(1)
  const [first = "", second = ""] = segments
  if (first === "wp-content" && second === "uploads" && segments.length > 2) {
    return { kind: "upload", path }
  }
  if (isMachinery(segments) || isFeed(segments)) {
    return { kind: "gone" }
  }
  if (isDateArchive(segments) || (first === "author" && segments.length === 2)) {
    return { kind: "page", path: BLOG }
  }
  const slug = segments.at(-1) ?? ""
  if ((first === "product-tag" || first === "urun-etiketi") && segments.length === 2) {
    return SLUG.test(slug) ? { kind: "product_tag", slug } : null
  }
  if ((first === "tag" || first === "etiket") && segments.length === 2) {
    return SLUG.test(slug) ? { kind: "post_term", taxonomy: "tag", slug } : null
  }
  // A blog category's archive under WordPress's base, a child's under its parents
  if (first === "category" && segments.length >= 2) {
    return SLUG.test(slug) ? { kind: "post_term", taxonomy: "category", slug } : null
  }
  const page = storePage(segments)
  return page ? { kind: "page", path: page } : null
}

const valueOf = (query: URLSearchParams, key: string): string => (query.get(key) ?? "").trim()

/** The keys `?p=12` may name: the post type when given, else a post, a product, a page. */
function recordKeys(query: URLSearchParams): string[] | null {
  const pageId = valueOf(query, "page_id")
  if (RECORD_ID.test(pageId)) {
    return [`page:${pageId}`]
  }
  const id = valueOf(query, "p") || valueOf(query, "post")
  if (!RECORD_ID.test(id)) {
    return null
  }
  const type = valueOf(query, "post_type")
  return type === "product" || type === "page" || type === "post"
    ? [`${type}:${id}`]
    : [`post:${id}`, `product:${id}`, `page:${id}`]
}

/** The home page's query addresses (`/?p=12`, `/?s=tava`, `/?product_cat=x`). */
function rootAddress(query: URLSearchParams): LegacyAddress | null {
  const keys = recordKeys(query)
  if (keys) {
    return { kind: "record_id", keys }
  }
  const slugOf = (key: string) => {
    const value = valueOf(query, key)
    return SLUG.test(value) ? value : null
  }
  const product = slugOf("product") ?? slugOf("name")
  if (product && (query.has("product") || valueOf(query, "post_type") === "product")) {
    return { kind: "product_slug", slug: product }
  }
  const category = slugOf("product_cat")
  if (category) {
    return { kind: "category_slug", slug: category }
  }
  const productTag = slugOf("product_tag")
  if (productTag) {
    return { kind: "product_tag", slug: productTag }
  }
  const tag = slugOf("tag")
  if (tag) {
    return { kind: "post_term", taxonomy: "tag", slug: tag }
  }
  const postCategory = slugOf("category_name")
  if (postCategory) {
    return { kind: "post_term", taxonomy: "category", slug: postCategory }
  }
  const text = valueOf(query, "s").slice(0, 100)
  if (text !== "") {
    return { kind: "search", text }
  }
  if (query.has("attachment_id") || query.has("feed")) {
    return { kind: "gone" }
  }
  if (["m", "author", "cat", "year", "monthnum"].some((key) => query.has(key))) {
    return { kind: "page", path: BLOG }
  }
  if (valueOf(query, "post_type") === "product") {
    return { kind: "page", path: SHOP }
  }
  return null
}

/** `?paged=2` (WordPress) or `?product-page=2` (WooCommerce's product block) on any list. */
function queryPage(query: URLSearchParams): number | null {
  const raw = valueOf(query, "paged") || valueOf(query, "product-page")
  return PAGE_NUMBER.test(raw) ? Number(raw) : null
}

/**
 * What WordPress address `request` was, if any: its path first (a feed,
 * an archive, a numbered page), then the home page's query addresses.
 */
export function wordpressAddress(request: RequestPath): LegacyAddress | null {
  const { query } = request
  const path = request.path === "/index.php" ? "/" : request.path
  const segments = path === "/" ? [] : path.split("/").slice(1)
  const paged = pagedPath(segments)
  if (paged) {
    return { kind: "paged", base: { path: paged.base, query: keptQuery(query) }, page: paged.page }
  }
  if (path === "/") {
    const root = rootAddress(query)
    if (root) {
      return root
    }
  }
  const page = queryPage(query)
  if (page !== null) {
    return { kind: "paged", base: { path, query: keptQuery(query) }, page }
  }
  if (path === "/") {
    // `/index.php` alone is the home page
    return request.path === "/index.php" ? { kind: "page", path: "/" } : null
  }
  return pathAddress(path)
}
