import { DEFAULT_ROBOTS_TXT } from "../../../modules/platform-settings/sections/seo"
import { actionableCount, robotsOpen, seoSetup } from "../setup-checklist"
import type { SeoSetupFacts } from "../setup-checklist"

const FRESH: SeoSetupFacts = {
  legalIdentity: false,
  legalTexts: false,
  canonicalHost: null,
  robotsTxt: DEFAULT_ROBOTS_TXT,
  shareImage: null,
  google: { platform: true, connected: false, searchConsole: false, merchant: false },
  indexNow: false,
}

const open = (facts: SeoSetupFacts) =>
  seoSetup(facts)
    .filter((entry) => !entry.done)
    .map((entry) => [entry.key, entry.blocked])

describe("seoSetup", () => {
  it("leaves a new shop's robots done and says what holds the rest", () => {
    expect(open(FRESH)).toEqual([
      ["legal_identity", null],
      ["legal_texts", null],
      ["canonical_host", null],
      ["share_image", null],
      ["search_console", "google_account"],
      ["merchant", "google_account"],
      ["indexnow", null],
    ])
  })

  it("leaves Google's items out until the platform opens Google (docs/06 principle 10)", () => {
    const closed = seoSetup({ ...FRESH, google: { ...FRESH.google, platform: false } })
    expect(closed.map((entry) => entry.key)).toEqual([
      "legal_identity",
      "legal_texts",
      "canonical_host",
      "robots",
      "share_image",
      "indexnow",
    ])
    expect(actionableCount(closed)).toBe(5)
    expect(actionableCount(seoSetup(FRESH))).toBe(7)
  })

  it("drops each item once it is done", () => {
    expect(
      open({
        legalIdentity: true,
        legalTexts: true,
        canonicalHost: "magaza.com.tr",
        robotsTxt: DEFAULT_ROBOTS_TXT,
        shareImage: "https://cdn.magaza.com.tr/paylasim.jpg",
        google: { platform: true, connected: true, searchConsole: true, merchant: true },
        indexNow: true,
      })
    ).toEqual([])
  })
})

describe("robotsOpen", () => {
  it("wants the home page crawlable and the sitemap named", () => {
    expect(robotsOpen(DEFAULT_ROBOTS_TXT)).toBe(true)
    expect(robotsOpen("User-agent: *\nDisallow: /\nSitemap: {sitemap_url}")).toBe(false)
    expect(robotsOpen("User-agent: *\nDisallow: /sepet")).toBe(false)
    // Googlebot's own group decides for it
    expect(
      robotsOpen("User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: x")
    ).toBe(true)
  })
})
