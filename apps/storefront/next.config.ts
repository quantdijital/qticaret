import type { NextConfig } from "next"

/**
 * Storefront build settings (adr/0046).
 *
 * - `htmlLimitedBots: /.*\/`: metadata never streams; title, meta, canonical
 *   and robots are in the first HTML's <head> for every user agent (docs/13 §1,
 *   docs/03 F18 "SSR zorunlu").
 * - `output: "standalone"`: the production image (F16) copies one folder.
 * - The workspace packages ship TypeScript source, so Next compiles them.
 * - Security headers that need no per-request value live here; the CSP needs
 *   a nonce and is set in `src/proxy.ts`.
 */
const SECURITY_HEADERS = [
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
      { source: "/:path*", headers: SECURITY_HEADERS },
      // A card provider may load its return address inside its form, framed
      // on our checkout (D7): those pages may be framed by our own pages
      {
        source: "/odeme/sonuc/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ]),
}

export default config
