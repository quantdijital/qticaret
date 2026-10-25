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
