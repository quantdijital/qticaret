import { robotsTxt } from "../robots"
import { SITEMAP_LIMITS, escapeXml, sitemapIndex, urlsetFiles } from "../sitemap"

const TEMPLATE = "User-agent: *\nDisallow: /sepet\n\nSitemap: {sitemap_url}"

describe("robotsTxt", () => {
  it("fills the sitemap address and adds nothing for the open presets", () => {
    for (const preset of ["ai_search_visible", "none"] as const) {
      expect(
        robotsTxt({
          template: TEMPLATE,
          sitemapUrl: "https://magaza.example.com/sitemap.xml",
          preset,
          indexing: true,
          filterKeys: [],
        })
      ).toBe("User-agent: *\nDisallow: /sepet\n\nSitemap: https://magaza.example.com/sitemap.xml\n")
    }
  })

  it("keeps training crawlers out in one group, and drops the sitemap line without a host", () => {
    const text = robotsTxt({
      template: TEMPLATE,
      sitemapUrl: null,
      preset: "block_training",
      indexing: true,
      filterKeys: [],
    })
    expect(text).not.toContain("Sitemap")
    expect(text).toContain("User-agent: GPTBot\nUser-agent: ClaudeBot\n")
    expect(text.trimEnd().endsWith("Disallow: /")).toBe(true)
    expect(text).not.toContain("OAI-SearchBot")
  })

  it("writes the listing filters' lines where the template asks for them", () => {
    const text = robotsTxt({
      template: "User-agent: *\nDisallow: /sepet\n{facet_disallow}\n\nSitemap: {sitemap_url}",
      sitemapUrl: null,
      preset: "none",
      indexing: true,
      filterKeys: ["renk", "fiyat"],
    })
    expect(text).toBe(
      [
        "User-agent: *",
        "Disallow: /sepet",
        "Disallow: /*?marka=",
        "Disallow: /*&marka=",
        "Disallow: /*?renk=",
        "Disallow: /*&renk=",
        "Disallow: /*?stok=",
        "Disallow: /*&stok=",
        "Disallow: /*?fiyat=",
        "Disallow: /*&fiyat=",
        "Disallow: /*?sirala=",
        "Disallow: /*&sirala=",
        "",
      ].join("\n")
    )
  })

  it("keeps every crawler out of a shop that must not be indexed", () => {
    expect(
      robotsTxt({
        template: TEMPLATE,
        sitemapUrl: null,
        preset: "none",
        indexing: false,
        filterKeys: [],
      })
    ).toBe("User-agent: *\nDisallow: /\n")
  })
})

describe("sitemap files", () => {
  const entry = (index: number) => ({
    loc: `https://magaza.example.com/urun/urun-${String(index)}?a=1&b=2`,
    lastmod: new Date("2026-10-26T10:00:00Z"),
    images: [`https://cdn.example.com/${String(index)}.webp`],
  })

  it("escapes addresses and writes images and the day of the last change", () => {
    const [file] = urlsetFiles("products", [entry(1)])
    expect(file?.name).toBe("sitemap-products-1.xml")
    expect(file?.content).toContain(
      "<url><loc>https://magaza.example.com/urun/urun-1?a=1&amp;b=2</loc><lastmod>2026-10-26</lastmod><image:image><image:loc>https://cdn.example.com/1.webp</image:loc></image:image></url>"
    )
    expect(escapeXml(`<"'&>`)).toBe("&lt;&quot;&apos;&amp;&gt;")
  })

  it("splits at the URL limit and writes nothing for no pages", () => {
    const entries = Array.from({ length: SITEMAP_LIMITS.urls + 1 }, (_, index) => ({
      loc: `https://magaza.example.com/urun/${String(index)}`,
      lastmod: null,
    }))
    expect(urlsetFiles("products", entries).map(({ name, urls }) => [name, urls])).toEqual([
      ["sitemap-products-1.xml", SITEMAP_LIMITS.urls],
      ["sitemap-products-2.xml", 1],
    ])
    expect(urlsetFiles("brands", [])).toEqual([])
  })

  it("indexes the files at the storefront's origin", () => {
    const index = sitemapIndex(
      [{ name: "sitemap-products-1.xml", lastmod: new Date("2026-10-26T00:00:00Z") }],
      "https://magaza.example.com"
    )
    expect(index).toContain(
      "<sitemap><loc>https://magaza.example.com/sitemap-products-1.xml</loc><lastmod>2026-10-26</lastmod></sitemap>"
    )
  })
})
