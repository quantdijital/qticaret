import { isCrawlable, parseRobots } from "./robots-match"

/**
 * The SEO setup checklist (docs/14 §5, F12.10): what a shop sets once so
 * search engines find, trust and show it. Each item is judged from the
 * shop's settings; a done item leaves the list.
 */

export const SEO_SETUP_ITEMS = [
  "legal",
  "canonical_host",
  "robots",
  "share_image",
  "search_console",
  "merchant",
  "indexnow",
] as const
export type SeoSetupItem = (typeof SEO_SETUP_ITEMS)[number]

/** Why an open item cannot be done from the panel yet. */
export type SeoSetupBlock =
  /** The legal details and policies screens come with F13. */
  | "coming"
  /** The platform has no Google client in this environment. */
  | "google_platform"
  /** Search Console and Merchant Center need the Google account first. */
  | "google_account"

export interface SeoSetupFacts {
  canonicalHost: string | null
  robotsTxt: string
  shareImage: string | null
  google: {
    /** The platform's Google client is configured. */
    platform: boolean
    /** The shop's Google account is connected. */
    connected: boolean
    /** Search Console granted and a site chosen. */
    searchConsole: boolean
    merchant: boolean
  }
  indexNow: boolean
}

export interface SeoSetupEntry {
  key: SeoSetupItem
  done: boolean
  blocked: SeoSetupBlock | null
}

const SITEMAP_LINE = /^\s*sitemap\s*:/im

/** Search engines may crawl the home page, and the file points them to the sitemap. */
export function robotsOpen(text: string): boolean {
  return isCrawlable(parseRobots(text), "googlebot", "/") && SITEMAP_LINE.test(text)
}

const googleBlock = (google: SeoSetupFacts["google"]): SeoSetupBlock | null =>
  !google.platform ? "google_platform" : !google.connected ? "google_account" : null

export function seoSetup(facts: SeoSetupFacts): SeoSetupEntry[] {
  const done: Record<SeoSetupItem, boolean> = {
    // Nothing records the legal details before F13
    legal: false,
    canonical_host: facts.canonicalHost !== null,
    robots: robotsOpen(facts.robotsTxt),
    share_image: facts.shareImage !== null,
    search_console: facts.google.searchConsole,
    merchant: facts.google.merchant,
    indexnow: facts.indexNow,
  }
  const blocked = (key: SeoSetupItem): SeoSetupBlock | null => {
    if (done[key]) {
      return null
    }
    switch (key) {
      case "legal":
        return "coming"
      case "search_console":
      case "merchant":
        return googleBlock(facts.google)
      case "canonical_host":
      case "robots":
      case "share_image":
      case "indexnow":
        return null
    }
  }
  return SEO_SETUP_ITEMS.map((key) => ({ key, done: done[key], blocked: blocked(key) }))
}

/** Open items the shop can take on now: not waiting for a later phase or the platform. */
export const actionableCount = (entries: readonly SeoSetupEntry[]): number =>
  entries.filter(
    (entry) => !entry.done && entry.blocked !== "coming" && entry.blocked !== "google_platform"
  ).length
