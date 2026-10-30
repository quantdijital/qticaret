import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The payment test page (adr/0028): static markup, style and script
 * files, put together and filled in per response. Development only; no build, theme or i18n.
 */

export interface DevCheckoutConfig {
  /** The demo storefront's key (`seed:demo`); null when none is seeded. */
  publishableKey: string | null
  /** Where an order opens in the panel. */
  panelUrl: string
}

// The panel's dev server port is fixed (`vite --strictPort`)
export const DEV_PANEL_URL = "http://localhost:5173"

const read = (name: string) => readFileSync(join(__dirname, name), "utf8")

/** Inline script and style run only with the response's nonce; calls go to this origin only. */
export const devCheckoutCsp = (nonce: string): string =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'self' data: http: https:",
    "connect-src 'self'",
    // The provider's form: the fake PayTR on 127.0.0.1, or a sandbox
    "frame-src http: https:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ")

/** The page with its settings as JSON a script tag cannot break out of. */
export function devCheckoutPage(config: DevCheckoutConfig, nonce: string): string {
  // Read per request, so an edit shows on reload; functions as replacements: `$` is no pattern
  const template = read("checkout.html")
    .replace("__STYLE__", () => read("checkout.css"))
    .replace("__SCRIPT__", () =>
      ["checkout.js", "checkout-contracts.js", "checkout-result.js"].map(read).join("\n")
    )
  const json = JSON.stringify(config).replace(/</g, "\\u003c")
  return template.replace(/__NONCE__/g, () => nonce).replace("__CONFIG__", () => json)
}
