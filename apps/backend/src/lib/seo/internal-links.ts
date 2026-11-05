import { isSafeHref } from "../content/doc"
import { RESERVED_ROOT_SEGMENTS } from "./paths"
import { encodePath, isBackendPath } from "./redirects"

/**
 * A text's links to the shop itself (adr/0042 Ek 2026-11-05): a path on
 * the shop (`/el-yapimi-caki`) or an absolute address on one of its hosts
 * (the shop's own domain, the old site a migration came from), resolved
 * as a visitor's request would be through the URL registry and the
 * redirect rules, and pointed at the page that answers today. A link
 * elsewhere is never touched; an address that answers nothing is
 * reported, never guessed.
 */

/** A host as the shop compares them: lower case, `www.` dropped. */
export const bareHost = (host: string): string =>
  host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")

const HOSTNAME = /^(?=.{1,253}$)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+$/

/** Whether a value names a host (`mylarte.com`), as a host list keeps them. */
export const isHostname = (value: string): boolean => HOSTNAME.test(bareHost(value))

/** A link on the shop: its path, query and fragment as written, and whether it named a host. */
export interface InternalLink {
  path: string
  /** `?…` or empty. */
  query: string
  /** `#…` or empty. */
  hash: string
  absolute: boolean
}

/**
 * The link on the shop that `href` is, or null for one elsewhere (another
 * host, `mailto:`, `tel:`), an anchor on the page and an address relative
 * to the page (no leading slash), which nothing here can place.
 */
export function internalLinkOf(href: string, hosts: ReadonlySet<string>): InternalLink | null {
  const value = href.trim()
  if (value.startsWith("/") && !value.startsWith("//")) {
    const url = new URL(value, "https://shop.invalid")
    return { path: url.pathname, query: url.search, hash: url.hash, absolute: false }
  }
  if (!/^(?:https?:)?\/\//i.test(value) || !URL.canParse(value, "https://shop.invalid")) {
    return null
  }
  const url = new URL(value, "https://shop.invalid")
  if (url.username !== "" || url.password !== "" || !hosts.has(bareHost(url.hostname))) {
    return null
  }
  return { path: url.pathname, query: url.search, hash: url.hash, absolute: true }
}

// The URL style's prefixes hold records (`/urun/x`): the registry answers for them
const RECORD_PREFIXES = new Set(["urun", "kategori", "marka", "koleksiyon", "blog"])

/**
 * The storefront's own pages, which no record holds and the registry does
 * not know: the home page, the blog's index, the system and index pages
 * under the reserved roots (`/sepet`, `/arama`, `/yasal/…`, `/magaza`).
 */
export function isStorefrontPage(path: string): boolean {
  if (path === "/" || path === "/blog") {
    return true
  }
  const first = path.split("/")[1] ?? ""
  return RESERVED_ROOT_SEGMENTS.has(first) && !RECORD_PREFIXES.has(first) && !isBackendPath(path)
}

/** What the shop answers at a link's address today, as resolve would (redirect chains followed). */
export type LinkAnswer =
  | { type: "live"; path: string }
  | { type: "moved"; location: string }
  | { type: "gone" }
  | { type: "not_found" }

export type UnresolvedReason = "gone" | "not_found"

export type LinkOutcome =
  | { status: "same" }
  | { status: "changed"; href: string }
  | { status: "unresolved"; reason: UnresolvedReason }

/**
 * What becomes of a link: a live page's own path (its form as the shop
 * keeps it: no host, no trailing slash), a moved one's new address, the
 * fragment kept; the same link when that is what it already says. A gone
 * or unknown address stays as written and is reported.
 */
export function outcomeOf(href: string, link: InternalLink, answer: LinkAnswer): LinkOutcome {
  if (answer.type === "gone" || answer.type === "not_found") {
    return { status: "unresolved", reason: answer.type }
  }
  const target =
    answer.type === "live"
      ? `${encodePath(answer.path)}${link.query}${link.hash}`
      : `${answer.location}${answer.location.includes("#") ? "" : link.hash}`
  if (!isSafeHref(target)) {
    return { status: "unresolved", reason: "not_found" }
  }
  return target === href ? { status: "same" } : { status: "changed", href: target }
}
