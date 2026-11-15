import type { NextConfig } from "next"
import { storefrontThemeName, themeEntries } from "./src/themes/choice"

/**
 * Storefront build settings (adr/0046).
 *
 * - `htmlLimitedBots: /.*\/`: metadata never streams; title, meta, canonical
 *   and robots are in the first HTML's <head> for every user agent (docs/13 §1,
 *   docs/03 F18 "SSR zorunlu").
 * - `output: "standalone"`: the production image (F16) copies one folder.
 * - The workspace packages ship TypeScript source, so Next compiles them.
 * - Security headers that need no per-request value live here (HSTS in
 *   production only); the CSP needs
 *   a nonce and is set in `src/proxy.ts`.
 * - `public/` (the faces) must be copied next to the standalone server in
 *   the image (F16), as `.next/static` is.
 * - The theme is chosen here, once per build (adr/0057): `STOREFRONT_THEME`
 *   names it (unset: `atolye`) and three aliases point at its entries under
 *   `src/themes/`: its pages, its stylesheet and its error page (a client
 *   component, adr/0046 Ek 2026-11-05).
 */
const THEME = themeEntries(storefrontThemeName(process.env["STOREFRONT_THEME"]))

const SECURITY_HEADERS = [
  // docs/runbooks/kenar-ve-pentest.md: HSTS comes from the application, a
  // year, in production only. Not `includeSubDomains`: the storefront lives
  // on the shop's own domain, whose other hosts are the shop's business
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
]

/** A served image file's own CSP (an SVG opened as a document): nothing but its inline styles. */
const IMAGE_FILE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

const config: NextConfig = {
  htmlLimitedBots: /.*/,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@qticaret/types", "@qticaret/ui", "@qticaret/theme-atolye"],
  turbopack: {
    resolveAlias: {
      "@qticaret/storefront-theme": THEME.pages,
      "@qticaret/storefront-theme-styles": THEME.styles,
      "@qticaret/storefront-theme-error": THEME.error,
    },
  },
  // Product images come as ready-made derivatives (adr/0016); Next does not
  // re-encode them
  images: { unoptimized: true },
  // A review's photos come through its form's action (adr/0037 §4 Ek
  // 2026-11-04): up to three, together at most this; the backend checks
  // each by its bytes. Every other action's body stays small by its schema
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // docs/13 §2.2: no trailing slash; the proxy answers with a single 301
  skipTrailingSlashRedirect: true,
  headers: () =>
    Promise.resolve([
      { source: "/:path((?!onizleme/).*)", headers: SECURITY_HEADERS },
      // The theme editor frames a preview page (adr/0049): its CSP's
      // frame-ancestors names the panel, which X-Frame-Options cannot
      {
        source: "/onizleme/:path*",
        // The link is a key: no page it loads learns it from the Referer
        headers: [
          ...SECURITY_HEADERS.filter(
            (header) => header.key !== "X-Frame-Options" && header.key !== "Referrer-Policy"
          ),
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      // A message's token link (adr/0038 Ek 2026-11-02), the maintenance
      // bypass link (adr/0053) and a payment link (adr/0051): no page it
      // loads learns the token from the Referer (this rule comes after the first)
      ...["/abonelik/:path*", "/stok-bildirimi/:path*", "/bakim/:path*", "/ode/:path*"].map(
        (source) => ({
          source,
          headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
        })
      ),
      // A card provider may load its return address inside its form, framed
      // on our checkout (D7): those pages may be framed by our own pages
      {
        source: "/odeme/sonuc/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      // The self-hosted faces (`app/fonts.css`): a content hash in each name,
      // so a file never changes under its address and is kept a year
      // (`public/` files are otherwise served with `max-age=0`)
      {
        source: "/fonts/:file",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // The providers' marks and the app's icon may be SVG: opened on their own
      // they run nothing and load nothing (an `<img>` of them is unaffected)
      ...["/marks/:file", "/icon.svg"].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: IMAGE_FILE_CSP }],
      })),
    ]),
}

export default config
