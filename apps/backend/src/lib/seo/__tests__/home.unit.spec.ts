import { homeSeo } from "../home"

const shop = { name: "Örnek Mağaza", canonicalHost: "magaza.example.com", indexing: true }
const blocks = [{ "@type": "OnlineStore" }, { "@type": "WebSite" }]

describe("homeSeo", () => {
  it("uses the shop's own title and description, with an absolute canonical", () => {
    const seo = homeSeo({
      shop,
      home: { title: "El Yapımı Seramik | Örnek", description: "Atölyeden kapınıza." },
      ogImage: "https://cdn.example.com/og.jpg",
      jsonLd: blocks,
    })

    expect(seo).toMatchObject({
      title: "El Yapımı Seramik | Örnek",
      description: "Atölyeden kapınıza.",
      canonical: "https://magaza.example.com/",
      robots: "index,follow",
      openGraph: { type: "website", url: "https://magaza.example.com/", siteName: "Örnek Mağaza" },
      twitter: { card: "summary_large_image", image: "https://cdn.example.com/og.jpg" },
      jsonLd: blocks,
      breadcrumbs: [],
    })
  })

  it("falls back to the shop's name and makes no description up", () => {
    const seo = homeSeo({
      shop,
      home: { title: null, description: null },
      ogImage: null,
      jsonLd: [],
    })

    expect(seo.title).toBe("Örnek Mağaza")
    expect(seo.description).toBe("")
    expect(seo.twitter.card).toBe("summary")
  })

  it("has no canonical nor structured data without a host, and noindex when not indexing", () => {
    const seo = homeSeo({
      shop: { ...shop, canonicalHost: null, indexing: false },
      home: { title: null, description: null },
      ogImage: null,
      jsonLd: blocks,
    })

    expect(seo.canonical).toBeNull()
    expect(seo.jsonLd).toEqual([])
    expect(seo.robots).toBe("noindex,nofollow")
  })
})
