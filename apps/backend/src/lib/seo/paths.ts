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
  // An order's page, the shop's legal texts, the whole catalogue (F18 D7, D10, D4)
  "siparis",
  "yasal",
  "magaza",
  "yorumlar",
  // The products on sale now (adr/0019 ek 2026-11-03)
  "kampanyalar",
  // Every category and every brand, as indexes (docs/20 "sayfalar")
  "kategoriler",
  "markalar",
  // A draft's signed preview (F18)
  "onizleme",
  // A message's token links (adr/0038 Ek 2026-11-02) and the cookie choices (F18 D9)
  "abonelik",
  "stok-bildirimi",
  "cerez-tercihleri",
  // The maintenance bypass link's page (adr/0053)
  "bakim",
  // A gift card's balance, `/hediye-karti/bakiye` (adr/0025 Ek 2026-11-03)
  "hediye-karti",
  // A payment link's page, `/ode/<token>` (adr/0051)
  "ode",
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

/**
 * Deeper paths the storefront keeps: the blog's archive prefixes (adr/0019
 * ek 2026-11-03) and its authors' (adr/0060), so no post takes `kategori`,
 * `etiket` or `yazar` as its handle.
 */
export const RESERVED_PATHS: ReadonlySet<string> = new Set([
  "/blog/kategori",
  "/blog/etiket",
  "/blog/yazar",
])

/** Whether `path` (`/arama`) is a path the storefront keeps for itself. */
export function isReservedPath(path: string): boolean {
  if (RESERVED_PATHS.has(path)) {
    return true
  }
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
  // The cookie choices: no one's search result, its links (the policy) may be followed
  { path: "/cerez-tercihleri", robots: "noindex,follow" },
  ...[
    "sepet",
    "odeme",
    "hesap",
    "giris",
    "kayit",
    "cikis",
    "onizleme",
    // A message's token links (adr/0038 Ek 2026-11-02)
    "abonelik",
    "stok-bildirimi",
    // The maintenance bypass link (adr/0053)
    "bakim",
    // A payment link's token page (adr/0051)
    "ode",
  ].map((segment) => ({
    path: `/${segment}`,
    robots: "noindex,nofollow" as const,
  })),
]
