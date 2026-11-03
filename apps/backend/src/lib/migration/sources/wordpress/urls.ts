/**
 * The old site's addresses as a WordPress export shows them: an item's
 * permalink (`<link>`) as its path, and the bases its archives sit under
 * (`/product-category/`, a Turkish install's `/urun-kategori/`, or none
 * when an SEO plugin took the base off), read from the links the site's
 * own texts make to them. Every path is kept as the old site served it,
 * its trailing slash included: the inventory normalises it (F14.7).
 */

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")

/** An item's path on the old site; none for an address elsewhere or one by query (`?p=12`). */
export function oldPathOf(link: string, site: URL | null): string | null {
  if (!URL.canParse(link)) {
    return null
  }
  const url = new URL(link)
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.search !== "" ||
    (site && bareHost(url.hostname) !== bareHost(site.hostname)) ||
    url.pathname === "/"
  ) {
    return null
  }
  return url.pathname
}

const HREF = /\bhref\s*=\s*["']([^"'<>]{1,2048})["']/gi
// A base is the root or one segment: `/`, `/urun-kategori/`
const BASE = /^\/(?:[a-z0-9-]{1,60}\/)?$/

/** Paths the texts link to on the old site (relative or absolute on its host), without a trailing slash. */
export function linkedPaths(texts: readonly string[], site: URL | null): string[] {
  const paths: string[] = []
  for (const text of texts) {
    for (const match of text.matchAll(HREF)) {
      const href = (match[1] ?? "").replace(/&amp;/g, "&")
      let path: string | null = null
      if (href.startsWith("/") && !href.startsWith("//")) {
        path = href
      } else if (site && URL.canParse(href)) {
        const url = new URL(href)
        path = bareHost(url.hostname) === bareHost(site.hostname) ? url.pathname : null
      }
      const clean = path?.split(/[?#]/)[0]?.replace(/\/+$/, "")
      if (clean) {
        paths.push(clean.toLowerCase())
      }
    }
  }
  return paths
}

/**
 * The base the site's archives of one kind sit under: the one its links
 * to them use most (each archive's slug path, `ust/alt`), else the
 * platform's default.
 */
export function detectBase(
  linked: readonly string[],
  archives: readonly string[],
  fallback: string
): string {
  const byLast = new Map<string, string[]>()
  for (const archive of archives) {
    const last = archive.split("/").pop() ?? archive
    byLast.set(last, [...(byLast.get(last) ?? []), archive])
  }
  const counts = new Map<string, number>()
  for (const path of linked) {
    const last = path.split("/").pop() ?? ""
    for (const archive of byLast.get(last) ?? []) {
      if (path.endsWith(`/${archive}`)) {
        const base = path.slice(0, -archive.length)
        if (BASE.test(base)) {
          counts.set(base, (counts.get(base) ?? 0) + 1)
        }
      }
    }
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1])
  return best?.[0] ?? fallback
}

/** A base as given (`urun-kategori`, `/urun-kategori`): one leading and one trailing slash. */
export function normalBase(base: string): string {
  const inner = base.trim().replace(/^\/+|\/+$/g, "")
  return inner === "" ? "/" : `/${inner}/`
}
