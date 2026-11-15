import { isStorefrontIndex, isSystemPath, normalizedPath } from "@/lib/seo/paths"

const BASE = "http://storefront.invalid"

/** The pages a design preview can show besides the home page (adr/0049). */
export type PreviewPage =
  | { kind: "home" }
  | { kind: "shop"; url: URL }
  | { kind: "blog"; url: URL }
  /** A record's page, found by resolving the path. */
  | { kind: "resolve"; url: URL }
  /** The visitor's own cart, drawn with the draft (live session only; adr/0065 Ek 2026-11-15). */
  | { kind: "cart"; url: URL }
  /** The site search's results, drawn with the draft (live session only). */
  | { kind: "search"; url: URL }

/**
 * Which page `/onizleme/<sfl_…>?sayfa=<path>` shows with the draft design:
 * a path on the shop (`/urun/…`, a category's, `/magaza?sirala=…`), in the
 * one form the proxy would have sent it on to (docs/13 §2.2). The home
 * page for none, `/`, the storefront's own system pages, or anything that
 * is not a path here (another host, `//host`, a backslash, too long).
 * With `system` (the theme editor's live session only, adr/0065 Ek
 * 2026-11-15) the cart and the site search too: drawn with the draft's
 * look, their data the visitor's own as live, never checkout or account.
 */
export function previewPage(
  raw: string | string[] | undefined,
  { system = false }: { system?: boolean } = {}
): PreviewPage {
  if (
    typeof raw !== "string" ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    raw.length > 2048
  ) {
    return { kind: "home" }
  }
  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return { kind: "home" }
  }
  if (url.origin !== BASE) {
    return { kind: "home" }
  }
  url.hash = ""
  url.pathname = normalizedPath(url.pathname) ?? url.pathname
  if (url.pathname === "/magaza") {
    return { kind: "shop", url }
  }
  if (url.pathname === "/blog") {
    return { kind: "blog", url }
  }
  if (system && url.pathname === "/sepet") {
    return { kind: "cart", url }
  }
  if (system && url.pathname === "/arama") {
    return { kind: "search", url }
  }
  if (url.pathname === "/" || isSystemPath(url.pathname) || isStorefrontIndex(url.pathname)) {
    return { kind: "home" }
  }
  return { kind: "resolve", url }
}
