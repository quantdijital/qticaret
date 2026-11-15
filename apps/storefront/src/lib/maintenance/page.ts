import { NextResponse } from "next/server"
import { t } from "../i18n"
import { escapeHtml } from "../security/html"
import { retryAfterSeconds } from "./rules"

/**
 * The dark shop's page (adr/0053): 503 with `Retry-After`, never stored,
 * plain HTML without the theme, its menu or anything of the catalogue.
 * Search engines read a 503 as "back soon" and keep the pages; a `noindex`
 * would drop them, so there is none (except on a broken bypass link, which
 * is nobody's page). Not `server-only`: the proxy answers with it.
 */

export interface MaintenanceNotice {
  shopName: string
  /** The shop's heading; null: the storefront's own. */
  title: string | null
  /** The shop's words, tokens filled; null: the storefront's own. */
  message: string | null
  /** ISO 8601; shown while it is ahead. */
  expectedAt: string | null
}

/** The shop's text goes into HTML as text, never as markup. */
export { escapeHtml }

const WHEN = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

/** "10 Kasım 2026 09:00" (Türkiye's time), while it is ahead; null otherwise. */
export function expectedLine(expectedAt: string | null, now = Date.now()): string | null {
  const at = expectedAt ? Date.parse(expectedAt) : Number.NaN
  return Number.isFinite(at) && at > now
    ? t("maintenance.expected", { when: WHEN.format(new Date(at)) })
    : null
}

// Readable without the theme's stylesheet; the response's nonce lets it through the CSP
const STYLE =
  "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f4ef;color:#1a1814;" +
  "font:16px/1.6 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
  "main{max-width:36rem;padding:3rem 1.5rem;text-align:center}" +
  "p.shop{font:500 1.25rem/1.3 ui-serif,Georgia,serif;margin:0 0 2rem}" +
  "h1{font:500 2rem/1.2 ui-serif,Georgia,serif;margin:0 0 1rem}" +
  "p{margin:0 0 .75rem}p.when{color:#5c574d;margin-top:1.5rem}a{color:inherit}"

/**
 * The page's HTML: the shop's name, its heading and words (or ours), the
 * expected opening; on a broken bypass link, that the link no longer opens.
 */
export function maintenanceHtml(
  notice: MaintenanceNotice,
  nonce: string,
  options: { linkInvalid?: boolean; now?: number } = {}
): string {
  const title = options.linkInvalid
    ? t("maintenance.link_invalid_title")
    : (notice.title ?? t("maintenance.title"))
  const words = options.linkInvalid
    ? [t("maintenance.link_invalid")]
    : (notice.message ?? t("maintenance.body")).split(/\n+/).filter((line) => line.trim() !== "")
  const when = options.linkInvalid ? null : expectedLine(notice.expectedAt, options.now)
  const shop = escapeHtml(notice.shopName)
  return (
    `<!doctype html><html lang="tr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    (options.linkInvalid ? `<meta name="robots" content="noindex">` : "") +
    `<title>${escapeHtml(title)} · ${shop}</title>` +
    `<style nonce="${escapeHtml(nonce)}">${STYLE}</style></head>` +
    `<body><main><p class="shop">${shop}</p><h1>${escapeHtml(title)}</h1>` +
    words.map((line) => `<p>${escapeHtml(line)}</p>`).join("") +
    (when ? `<p class="when">${escapeHtml(when)}</p>` : "") +
    (options.linkInvalid ? `<p><a href="/">${t("maintenance.home")}</a></p>` : "") +
    `</main></body></html>`
  )
}

/**
 * The suspended shop's page (adr/0061 Ek C15): the maintenance page's
 * look, the platform's words. The shop's heading, message and expected
 * opening are not read: it cannot word or time a suspension.
 */
export const suspendedNotice = (shopName: string): MaintenanceNotice => ({
  shopName,
  title: t("suspended.title"),
  message: t("suspended.body"),
  expectedAt: null,
})

/**
 * The 503 itself:`Retry-After`, `Cache-Control: no-store` and the page's
 * CSP; a HEAD gets the headers only. A broken bypass link's page is kept
 * out of indexes and leaks no Referer.
 */
export function maintenanceResponse(
  notice: MaintenanceNotice,
  {
    nonce,
    csp,
    head = false,
    linkInvalid = false,
    now = Date.now(),
  }: {
    nonce: string
    csp: string
    head?: boolean
    linkInvalid?: boolean
    now?: number
  }
): NextResponse {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "retry-after": String(retryAfterSeconds(notice.expectedAt, now)),
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
  })
  if (linkInvalid) {
    headers.set("x-robots-tag", "noindex")
    headers.set("referrer-policy", "no-referrer")
  }
  return new NextResponse(head ? null : maintenanceHtml(notice, nonce, { linkInvalid, now }), {
    status: 503,
    headers,
  })
}
