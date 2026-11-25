import { createHash } from "node:crypto"

/**
 * Rules for a page's own SEO fields (adr/0015). Caps keep data sane; the
 * SERP targets (30–60 and 70–155 characters) are the advisor's to warn
 * about, not a reason to refuse. Pure, so tested on its own.
 */

export const SEO_META_LIMITS = {
  seo_title: 150,
  seo_description: 320,
  // Up to five keywords of 60 characters, joined by ", " (focus-keywords.ts)
  focus_keyword: 320,
  og_image_alt: 200,
} as const

const MAX_PATH = 500
// A path on this site: one leading slash, no host, no backslash, no query or fragment
const SITE_PATH = /^\/(?!\/)[^\s?#\\]*$/

/** A canonical override must stay on this shop's own domain (docs/13 §2): a path, never a URL. */
export function isSitePath(value: string): boolean {
  return value.length <= MAX_PATH && SITE_PATH.test(value) && !value.split("/").includes("..")
}

/**
 * The text as a search engine compares it: Turkish lower case, spaces
 * collapsed; hashed so duplicates within a page type are found by index.
 */
export function seoTextHash(text: string | null | undefined): string | null {
  const normalized = (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr")
  return normalized ? createHash("sha256").update(normalized).digest("hex") : null
}
