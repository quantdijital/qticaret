/**
 * Root segments the storefront keeps for itself (docs/13 §2.2): the
 * prefixes of the prefixed URL style and the system pages. With the flat
 * style a product, category or page slug sits at the root, so no record may
 * take one of these as its whole path (`/arama`, `/sepet`); deeper paths
 * (`/kategori/bicak`) are what the prefixes are for.
 */
export const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  // URL style prefixes
  "urun",
  "kategori",
  "marka",
  "koleksiyon",
  "blog",
  // Storefront system pages; robots.txt keeps several of them out (S9 default)
  "arama",
  "sepet",
  "odeme",
  "hesap",
  "giris",
  "kayit",
  "cikis",
  // An order's page and the shop's legal texts (F18 D7, D10)
  "siparis",
  "yasal",
  // Backend paths, should a proxy put them on the storefront's host (F16)
  "admin",
  "app",
  "api",
  "auth",
  "health",
  "hooks",
  "static",
  "store",
])

/** Whether `path` (`/arama`) is a root path the storefront keeps for itself. */
export function isReservedPath(path: string): boolean {
  const segments = path.split("/").slice(1)
  return segments.length === 1 && RESERVED_ROOT_SEGMENTS.has(segments[0] ?? "")
}

/**
 * How the storefront's own pages are indexed (docs/13 §6, §7): search
 * results stay out of the index but their links are followed; the rest
 * are nobody's search result. robots.txt keeps several of them out too.
 */
export const SYSTEM_PAGES: readonly {
  path: string
  robots: "noindex,follow" | "noindex,nofollow"
}[] = [
  { path: "/arama", robots: "noindex,follow" },
  ...["sepet", "odeme", "hesap", "giris", "kayit", "cikis"].map((segment) => ({
    path: `/${segment}`,
    robots: "noindex,nofollow" as const,
  })),
]
