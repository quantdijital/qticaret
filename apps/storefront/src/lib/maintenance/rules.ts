/**
 * The dark shop's rules (adr/0053 "Vitrinin yapacakları"): which paths stay
 * open, how long a crawler is asked to wait, and what a bypass link's
 * token looks like. Pure: the proxy, the bypass route and the tests share
 * them. Not `server-only`: the proxy runs outside React's server environment.
 */
import { backendFile } from "../seo/paths"

/** The page that takes a bypass link (`/bakim/gir?t=<token>`) and sets its cookie. */
export const BYPASS_PATH = "/bakim/gir"

/** The bypass cookie's name before the `__Host-` prefix production adds. */
export const BYPASS_COOKIE = "qt_bypass"

/** A bypass link lasts a week (backend `BYPASS_DAYS`); so does its cookie. */
export const BYPASS_MAX_AGE = 7 * 24 * 60 * 60

/**
 * The backend's token shape (`lib/storefront/maintenance.ts`): `mnb_`, 12
 * random bytes in base64url, the end in base 36 seconds, the HMAC. Anything
 * else is never sent to the backend.
 */
const BYPASS_TOKEN = /^mnb_[\w-]{16}\.[0-9a-z]{1,12}\.[\w-]{43}$/

export const isBypassToken = (value: string | null | undefined): value is string =>
  typeof value === "string" && BYPASS_TOKEN.test(value)

/** `__Host-qt_bypass` over HTTPS, `qt_bypass` on a developer's http://localhost. */
export const bypassCookieName = (production: boolean): string =>
  production ? `__Host-${BYPASS_COOKIE}` : BYPASS_COOKIE

/** `Retry-After` when the shop gave no time, or one already past: an hour. */
export const RETRY_AFTER_DEFAULT = 3600
const RETRY_AFTER_MIN = 300
const RETRY_AFTER_MAX = 86_400

/**
 * Seconds until the shop expects to open, between five minutes and a day
 * (a crawler asked to wait longer forgets the page sooner); an hour when
 * no time is given, it is unreadable or already past.
 */
export function retryAfterSeconds(expectedAt: string | null, now = Date.now()): number {
  const at = expectedAt ? Date.parse(expectedAt) : Number.NaN
  if (!Number.isFinite(at) || at <= now) {
    return RETRY_AFTER_DEFAULT
  }
  return Math.min(RETRY_AFTER_MAX, Math.max(RETRY_AFTER_MIN, Math.ceil((at - now) / 1000)))
}

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`)

/**
 * Next's and the browser's own files the storefront serves while dark:
 * the app's icon (`app/icon.svg`), the favicon and a manifest. The build's
 * files (`/_next/static`) never reach the proxy.
 */
const STATIC_FILES = new Set([
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/manifest.webmanifest",
])

/**
 * Next's own requests that may reach the proxy: the build's files and
 * images (the matcher leaves them out already) and the dev server's
 * reload socket. Not every `/_next/` path: nothing else of Next's is a
 * dark shop's business (adr/0061 Ek C15 review L3).
 */
const NEXT_OWN = /^\/_next\/(?:static\/|image(?:\/|$)|webpack-hmr$)/

/**
 * robots.txt, the sitemaps and security.txt, by their exact names
 * (`backendFile`): the proxy answers them from the backend before it looks
 * at maintenance; listed here too so a rule change cannot darken them. A
 * page whose path only starts like one (`/sitemap-kampanya`) is a page
 * (review L3), and the backend gives no record such a path.
 */
const isCrawlerFile = (path: string) => backendFile(path) !== null

/**
 * The storefront's own paths that stay open while the shop is dark:
 * - a preview (the panel's theme editor and a draft's link);
 * - a card provider's return and the page it sends to (a paid shopper
 *   must not meet the maintenance page);
 * - the bypass link's page;
 * - robots.txt and the sitemaps (a 5xx robots.txt stops all crawling);
 * - Next's own files and the dev server's socket, and static files.
 * The IndexNow key file and the backend's files are answered before the
 * proxy looks at maintenance.
 */
export function isStorefrontOpenPath(path: string): boolean {
  return (
    path.startsWith("/onizleme/") ||
    under(path, "/odeme/sonuc") ||
    under(path, "/odeme/durum") ||
    path === BYPASS_PATH ||
    isCrawlerFile(path) ||
    NEXT_OWN.test(path) ||
    STATIC_FILES.has(path)
  )
}

/**
 * What stays open while the platform has suspended the shop (adr/0061
 * §5.5, Ek C15): robots.txt and the sitemaps (crawlers keep the pages), a
 * card provider's return (a payment already started settles), Next's own
 * files and static files. Narrower than maintenance: no preview, no
 * bypass link's page, none of the shop's own open paths; the shop cannot
 * open a suspended storefront.
 */
export function isOpenWhileSuspended(path: string): boolean {
  return (
    under(path, "/odeme/sonuc") ||
    under(path, "/odeme/durum") ||
    isCrawlerFile(path) ||
    NEXT_OWN.test(path) ||
    STATIC_FILES.has(path)
  )
}

/** A path as the backend stores `allow_paths`: lower case, no trailing slash. */
export function comparablePath(path: string): string {
  const lower = path.toLowerCase()
  return lower.length > 1 ? lower.replace(/\/+$/, "") || "/" : lower
}

/**
 * Whether one of the shop's open paths lets `path` through: `/iletisim`
 * exactly, `/sozlesmeler/*` for `/sozlesmeler` and everything below it.
 * Both sides compared as the backend normalises them.
 */
export function isAllowedPath(path: string, allowPaths: readonly string[]): boolean {
  const target = comparablePath(path)
  return allowPaths.some((entry) => {
    const rule = comparablePath(entry)
    if (rule.endsWith("/*")) {
      const root = rule.slice(0, -2)
      return root !== "" && under(target, root)
    }
    return rule === target
  })
}

/**
 * A preview is open to look at, never to act from: every page carries the
 * root layout's Server Actions (the cart, the cookie choices), and Next runs
 * one posted to any address its route matches (`/onizleme/x` included)
 * before the page reads the token. So while dark, only GET and HEAD pass
 * there by path; anything else needs the bypass cookie like every page.
 */
const isPreviewWrite = (path: string, method: string) =>
  path.startsWith("/onizleme/") && method !== "GET" && method !== "HEAD"

/** Whether a request is answered as usual while the shop is dark, cookie aside. */
export const isOpenDuringMaintenance = (
  path: string,
  method: string,
  allowPaths: readonly string[]
): boolean =>
  !isPreviewWrite(path, method) && (isStorefrontOpenPath(path) || isAllowedPath(path, allowPaths))
