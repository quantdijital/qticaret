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
] as const

/**
 * Index pages the storefront makes itself under a reserved root (backend
 * `RESERVED_ROOT_SEGMENTS`): exactly these paths skip resolve; the records
 * under them (`/blog/{handle}`) still go through it.
 */
export const STOREFRONT_INDEXES = ["/blog", "/magaza", "/yorumlar"] as const

export const isStorefrontIndex = (pathname: string): boolean =>
  (STOREFRONT_INDEXES as readonly string[]).includes(pathname)

export function isSystemPath(pathname: string): boolean {
  const first = pathname.split("/")[1]?.toLowerCase() ?? ""
  return (SYSTEM_ROOTS as readonly string[]).includes(first)
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
