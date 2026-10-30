import { isCrawlable, parseRobots } from "./robots-match"

/**
 * The SEO setup checklist (docs/14 §5, F12.10): what a shop sets once so
 * search engines find, trust and show it. Each item is judged from the
 * shop's settings; a done item leaves the list.
 */

export const SEO_SETUP_ITEMS = [
  "legal_identity",
  "legal_texts",
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
  /** The platform has no Google client in this environment. */
  | "google_platform"
  /** Search Console and Merchant Center need the Google account first. */
  | "google_account"

export interface SeoSetupFacts {
  /** The shop's legal identity is complete (F13.9). */
  legalIdentity: boolean
  /** The legal texts a shop must show are published (F13.1). */
  legalTexts: boolean
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
    legal_identity: facts.legalIdentity,
    legal_texts: facts.legalTexts,
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
      case "search_console":
      case "merchant":
        return googleBlock(facts.google)
      case "legal_identity":
      case "legal_texts":
      case "canonical_host":
      case "robots":
      case "share_image":
      case "indexnow":
        return null
    }
  }
  return SEO_SETUP_ITEMS.map((key) => ({ key, done: done[key], blocked: blocked(key) }))
}

/** Open items the shop can take on now: not waiting for the platform. */
export const actionableCount = (entries: readonly SeoSetupEntry[]): number =>
  entries.filter((entry) => !entry.done && entry.blocked !== "google_platform").length
