import type { NextConfig } from "next"

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
 */
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

const config: NextConfig = {
  htmlLimitedBots: /.*/,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@qticaret/types", "@qticaret/ui", "@qticaret/theme-base"],
  // Product images come as ready-made derivatives (adr/0016); Next does not
  // re-encode them
  images: { unoptimized: true },
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
      // A message's token link (adr/0038 Ek 2026-11-02): no page it loads
      // learns the token from the Referer (this rule comes after the first)
      ...["/abonelik/:path*", "/stok-bildirimi/:path*"].map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
      // A card provider may load its return address inside its form, framed
      // on our checkout (D7): those pages may be framed by our own pages
      {
        source: "/odeme/sonuc/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ]),
}

export default config
