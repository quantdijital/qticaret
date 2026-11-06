/**
 * The storefront's own pages (backend `lib/seo/paths.ts`): they never go
 * through resolve, and their addresses carry ids and tokens whose case
 * matters, so URL normalisation leaves their case alone.
 */
export const SYSTEM_ROOTS = [
  "sepet",
  "odeme",
  "hesap",
  "giris",
  "kayit",
  "cikis",
  "arama",
  "siparis",
  "yasal",
  "onizleme",
  // A message's token links (adr/0038 Ek 2026-11-02) and the cookie choices (D9)
  "abonelik",
  "stok-bildirimi",
  "cerez-tercihleri",
  // The maintenance bypass link's page (adr/0053)
  "bakim",
  // A gift card's balance (adr/0025 Ek 2026-11-03): the backend must reserve it too
  "hediye-karti",
  // A payment link's page, `/ode/<token>` (adr/0051): its token's case matters
  "ode",
  // The storefront's own route handlers (`/api/yenile`, the live search's `/api/search/suggest`):
  // never a record (the backend reserves `api`), never a 404 to report
  "api",
] as const

/**
 * Index pages the storefront makes itself under a reserved root (backend
 * `RESERVED_ROOT_SEGMENTS`): exactly these paths skip resolve; the records
 * under them (`/blog/{handle}`) still go through it. `/kampanyalar` is
 * reserved too, but resolve answers it (`sale`: its listing query, its
 * seo object), so it is no index of ours.
 */
export const STOREFRONT_INDEXES = [
  "/blog",
  "/magaza",
  "/yorumlar",
  // Every category, every brand (docs/20 "sayfalar")
  "/kategoriler",
  "/markalar",
] as const

/**
 * Deeper paths the storefront keeps (backend `RESERVED_PATHS`): the blog's
 * archive prefixes (adr/0019 ek 2026-11-03). No post takes `kategori` or
 * `etiket` as its handle; the archives under them
 * (`/blog/kategori/{handle}`) go through resolve.
 */
export const BLOG_ARCHIVE_PREFIXES = { category: "/blog/kategori", tag: "/blog/etiket" } as const

/**
 * Files Next or `public/` serve as they are: the app's metadata files
 * (`app/icon.svg`; the others if ever added), the self-hosted faces
 * (`app/fonts.css`, a content hash in each name) and the providers' marks
 * (`public/marks/`). Never a page: no
 * resolve, no 404 report, no maintenance page. `proxy.ts`'s matcher
 * leaves the same addresses out, exactly these and nothing that only
 * starts like them.
 */
const METADATA_FILES: readonly string[] = [
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/manifest.webmanifest",
]
const FONT_FILE = /^\/fonts\/[a-z-]+\.[0-9a-f]{10}\.woff2$/
// The providers' marks in the footer (`public/marks/`, card-extras `MARK_LOGOS`)
const MARK_FILE = /^\/marks\/[a-z_]+\.(?:svg|png)$/

export const isStaticFile = (pathname: string): boolean =>
  METADATA_FILES.includes(pathname) || FONT_FILE.test(pathname) || MARK_FILE.test(pathname)

export const isStorefrontIndex = (pathname: string): boolean =>
  (STOREFRONT_INDEXES as readonly string[]).includes(pathname)

export function isSystemPath(pathname: string): boolean {
  const first = pathname.split("/")[1]?.toLowerCase() ?? ""
  return (SYSTEM_ROOTS as readonly string[]).includes(first)
}

/**
 * The pages a crawler reads: the home page, the storefront's lists, every
 * record's page and the site search. Never the cart, checkout, account,
 * a token link or a route handler (a payment's return must always land).
 */
export const isCataloguePage = (pathname: string): boolean =>
  !isSystemPath(pathname) || pathname === "/arama"

/**
 * The query addresses an old platform answered at the home page and on
 * its lists (adr/0059; WordPress's `/?p=12`, `/?s=`, `/blog?paged=2`).
 * Only with one of them do the home page and the storefront's own lists
 * ask resolve, so the backend can send the visitor on; never otherwise.
 */
const OLD_HOME_QUERY = new Set([
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
])
const OLD_LIST_QUERY = new Set(["paged", "product-page"])

/** Whether the proxy asks resolve about a page view at this address (docs/13 §4). */
export function resolvesAt(pathname: string, search: string): boolean {
  if (isSystemPath(pathname)) {
    return false
  }
  if (pathname !== "/" && !isStorefrontIndex(pathname)) {
    return true
  }
  const old = pathname === "/" ? OLD_HOME_QUERY : OLD_LIST_QUERY
  return [...new URLSearchParams(search).keys()].some((key) => old.has(key))
}

/** Files the backend makes and the storefront serves at its root (docs/13 §6, F15.9). */
export function backendFile(pathname: string): string | null {
  if (pathname === "/robots.txt") {
    return "/store/seo/robots"
  }
  if (/^\/sitemap(?:-[a-z]+-\d{1,4})?\.xml$/.test(pathname)) {
    return `/store/seo/sitemaps${pathname}`
  }
  if (pathname === "/.well-known/security.txt") {
    return "/store/seo/security"
  }
  return null
}

/**
 * The one address a path should have (docs/13 §2.2): no repeated slashes,
 * no trailing slash, no `index.html`, lower case outside the storefront's
 * own pages. Null when the path is already so; a 301 goes there otherwise.
 */
export function normalizedPath(pathname: string): string | null {
  let path = pathname.replace(/\/{2,}/g, "/")
  path = path.replace(/\/index\.html?$/i, "/")
  if (path.length > 1) {
    path = path.replace(/\/+$/, "")
  }
  if (!isSystemPath(path)) {
    path = path.toLowerCase()
  }
  if (path === "") {
    path = "/"
  }
  return path === pathname ? null : path
}

/**
 * The 301 to the shop's one host (docs/13 §2.2), or null when the request
 * is already there or no host is set. The request's host comes as sent,
 * port and case aside; the target is always https.
 */
export function canonicalHostRedirect(
  requestHost: string | null,
  canonicalHost: string | null,
  pathAndSearch: string
): string | null {
  if (!canonicalHost || !requestHost) {
    return null
  }
  const host = requestHost.trim().toLowerCase().replace(/:\d+$/, "")
  return host === canonicalHost ? null : `https://${canonicalHost}${pathAndSearch}`
}

const INDEXNOW_FILE = /^\/([A-Za-z0-9-]{8,128})\.txt$/

/** The IndexNow key file's answer (`/{key}.txt`, docs/13 §6): the key, when the path names it. */
export function indexNowFile(pathname: string, key: string | null): string | null {
  const match = INDEXNOW_FILE.exec(pathname)
  return key && match?.[1] === key ? key : null
}
