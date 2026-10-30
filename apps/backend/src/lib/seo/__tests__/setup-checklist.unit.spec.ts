import { DEFAULT_ROBOTS_TXT } from "../../../modules/platform-settings/sections/seo"
import { robotsOpen, seoSetup } from "../setup-checklist"
import type { SeoSetupFacts } from "../setup-checklist"

const FRESH: SeoSetupFacts = {
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
      ["legal", "coming"],
      ["canonical_host", null],
      ["share_image", null],
      ["search_console", "google_account"],
      ["merchant", "google_account"],
      ["indexnow", null],
    ])
    expect(open({ ...FRESH, google: { ...FRESH.google, platform: false } })).toContainEqual([
      "merchant",
      "google_platform",
    ])
  })

  it("drops each item once it is done", () => {
    expect(
      open({
        canonicalHost: "magaza.com.tr",
        robotsTxt: DEFAULT_ROBOTS_TXT,
        shareImage: "https://cdn.magaza.com.tr/paylasim.jpg",
        google: { platform: true, connected: true, searchConsole: true, merchant: true },
        indexNow: true,
      })
    ).toEqual([["legal", "coming"]])
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
