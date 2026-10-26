import {
  SITEMAP_MAX_AGE_MS,
  finding,
  hostFinding,
  redirectItem,
  robotsFinding,
  sitemapFinding,
} from "../audit"
import { robotsTxt } from "../robots"

const NOW = new Date("2026-10-26T04:30:00Z")
const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)
const PAGES = ["/", "/urun/ornek-urun", "/kategori/ornek-kategori", "/marka/ornek-marka"]

describe("store-wide SEO audit rules (docs/14 §3.9)", () => {
  it("has no finding without items, and counts beyond the ones it keeps", () => {
    expect(finding("S-ORPHAN-01", [])).toBeNull()
    expect(finding("S-ORPHAN-01", [{ reason: "no_category", subject: "Kupa" }], 40)).toEqual({
      ruleId: "S-ORPHAN-01",
      severity: "high",
      count: 40,
      items: [{ reason: "no_category", subject: "Kupa" }],
    })
  })

  describe("host and indexing", () => {
    it("wants a live shop to have a host and be open to search engines", () => {
      expect(hostFinding({ host: "ornek.com", isIndexingOn: true, isStaging: false })).toBeNull()
      expect(
        hostFinding({ host: null, isIndexingOn: false, isStaging: false })?.items.map(
          (item) => item.reason
        )
      ).toEqual(["no_host", "indexing_off"])
    })

    it("wants a staging copy closed to them, host or not", () => {
      expect(hostFinding({ host: null, isIndexingOn: false, isStaging: true })).toBeNull()
      expect(hostFinding({ host: null, isIndexingOn: true, isStaging: true })).toMatchObject({
        severity: "critical",
        items: [{ reason: "staging_indexed" }],
      })
    })
  })

  describe("robots.txt", () => {
    it("passes the shop's default file with training crawlers blocked", () => {
      const robots = robotsTxt({
        template: "User-agent: *\nDisallow: /hesabim\nDisallow: /sepet\n\nSitemap: {sitemap_url}",
        sitemapUrl: "https://ornek.com/sitemap.xml",
        preset: "block_training",
        indexing: true,
      })
      expect(robotsFinding(robots, true, PAGES)).toBeNull()
    })

    it("finds a kind of page closed to every crawler", () => {
      expect(robotsFinding("User-agent: *\nDisallow: /urun*\n", false, PAGES)?.items).toEqual([
        { reason: "blocked_all", subject: "/urun/ornek-urun" },
      ])
      // The home page only: Allow keeps the rest open
      expect(
        robotsFinding(
          "User-agent: *\nDisallow: /\nAllow: /urun/\nAllow: /kategori/\nAllow: /marka/\n",
          false,
          PAGES
        )?.items
      ).toEqual([{ reason: "blocked_all", subject: "/" }])
    })

    it("finds Google or Bing kept out by rules of their own", () => {
      const robots = "User-agent: *\nDisallow: /sepet\n\nUser-agent: Googlebot\nDisallow: /\n"
      expect(robotsFinding(robots, false, ["/", "/urun/ornek-urun"])?.items).toEqual([
        { reason: "blocked", subject: "/", target: "Googlebot" },
        { reason: "blocked", subject: "/urun/ornek-urun", target: "Googlebot" },
      ])
    })

    it("wants the sitemap named once there is a host", () => {
      const robots = "User-agent: *\nDisallow: /sepet\n"
      expect(robotsFinding(robots, false, PAGES)).toBeNull()
      expect(robotsFinding(robots, true, PAGES)?.items).toEqual([
        { reason: "no_sitemap", subject: "Sitemap:" },
      ])
    })
  })

  describe("sitemap", () => {
    const fresh = {
      hasHost: true,
      generatedAt: ago(0.5),
      isDirty: false,
      hasFailedRun: false,
      urls: 95,
      expected: 100,
      pathless: 0,
    }
    const reasons = (
      facts: typeof fresh | (Omit<typeof fresh, "generatedAt"> & { generatedAt: Date | null })
    ) => sitemapFinding(facts, NOW)?.items.map((item) => item.reason) ?? []

    it("is quiet while fresh and about complete, and without a host", () => {
      expect(sitemapFinding(fresh, NOW)).toBeNull()
      expect(sitemapFinding({ ...fresh, hasHost: false, generatedAt: null }, NOW)).toBeNull()
    })

    it("finds an old, a never built, a failed or a short sitemap", () => {
      const old = new Date(NOW.getTime() - SITEMAP_MAX_AGE_MS - 1)
      expect(reasons({ ...fresh, generatedAt: old })).toEqual(["stale"])
      expect(reasons({ ...fresh, generatedAt: null })).toEqual(["never"])
      expect(reasons({ ...fresh, hasFailedRun: true })).toEqual(["failed"])
      expect(sitemapFinding({ ...fresh, urls: 80 }, NOW)?.items).toEqual([
        { reason: "missing", subject: "urls", count: 20 },
      ])
      // A refresh is on its way: the count catches up then
      expect(sitemapFinding({ ...fresh, urls: 80, isDirty: true }, NOW)).toBeNull()
    })

    it("names live pages that have no address to list", () => {
      expect(sitemapFinding({ ...fresh, pathless: 3 }, NOW)?.items).toEqual([
        { reason: "no_path", subject: "url_registry", count: 3 },
      ])
    })
  })

  describe("redirects", () => {
    const rule = (extra: object = {}) => ({
      source: "/eski",
      target: "/urun/kupa" as string | null,
      hits: 5,
      lastHitAt: ago(3),
      createdAt: ago(400),
      sourceAnswer: "redirect" as const,
      targetAnswer: "entity" as const,
      ...extra,
    })
    const reason = (extra: object = {}) => redirectItem(rule(extra), NOW)?.reason ?? null

    it("leaves a rule alone that lands on a live page and is followed", () => {
      expect(reason()).toBeNull()
    })

    it("names the most pressing problem of a rule", () => {
      expect(reason({ sourceAnswer: "entity" })).toBe("shadowed")
      expect(reason({ targetAnswer: "not_found" })).toBe("dead_target")
      expect(reason({ targetAnswer: "gone" })).toBe("gone_target")
      expect(reason({ targetAnswer: "redirect" })).toBe("chain")
      expect(reason({ sourceAnswer: "entity", targetAnswer: "redirect" })).toBe("shadowed")
    })

    it("finds rules no one followed in a year, once they are a year old", () => {
      expect(redirectItem(rule({ lastHitAt: ago(366), hits: 12 }), NOW)).toEqual({
        reason: "idle",
        subject: "/eski",
        target: "/urun/kupa",
        count: 12,
      })
      expect(reason({ lastHitAt: null, target: null, targetAnswer: undefined })).toBe("idle")
      expect(reason({ lastHitAt: null, createdAt: ago(30) })).toBeNull()
    })
  })
})
