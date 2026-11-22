import { parseRobots, isCrawlable } from "../robots-match"
import type { SeoPayload } from "../resolve"
import { facetDisallowLines } from "../facets-robots"
import { filterKeysOf, isNarrowed, listingSearch, readListingQuery, singleFilter } from "../facets"
import type { ListingQuery } from "../facets"
import { listingSeo } from "../listing-seo"

const KEYS = filterKeysOf(["renk", "malzeme", "fiyat", "boy_cm"])
const read = (search: string) => readListingQuery(new URLSearchParams(search), KEYS)
const listing = (search: string): { query: ListingQuery; isCanonical: boolean } => {
  const result = read(search)
  if (result.kind !== "listing") {
    throw new Error("not a listing")
  }
  return result
}

describe("listing query", () => {
  it("keeps a canonical query as it is", () => {
    const search = "marka=atolye&malzeme=seramik&renk=kirmizi,mavi"
    const { query, isCanonical } = listing(search)
    expect(isCanonical).toBe(true)
    expect(listingSearch(query)).toBe(search)
    expect(listing("marka=atolye&malzeme=seramik&renk=mavi,kirmizi").isCanonical).toBe(false)
  })

  it.each([
    ["another order", "renk=mavi&marka=atolye", "marka=atolye&renk=mavi"],
    ["a repeated key", "renk=mavi&renk=kirmizi", "renk=kirmizi,mavi"],
    ["a doubled value", "renk=mavi,mavi", "renk=mavi"],
    ["the first page", "sayfa=1", ""],
    ["a page that is no number", "sayfa=iki&renk=mavi", "renk=mavi"],
    ["the default sort", "sirala=onerilen", ""],
    ["an unknown sort", "sirala=rastgele", ""],
    ["a reversed price range", "fiyat=500-100", ""],
    ["an empty or malformed value", "renk=&malzeme=Seramik!", ""],
    ["values joined by a plus", "renk=kirmizi+mavi", ""],
    ["a price with a leading zero", "fiyat=0100-200", "fiyat=100-200"],
    ["an empty price range", "fiyat=-", ""],
  ])("puts %s in canonical form", (_label, search, canonical) => {
    const read = listing(search)
    expect(read.isCanonical).toBe(false)
    expect(listingSearch(read.query)).toBe(canonical)
  })

  it("reads `stok=var` as a filter among the others, any other value as none (adr/0056)", () => {
    const { query, isCanonical } = listing("marka=atolye&renk=mavi&stok=var")
    expect(isCanonical).toBe(true)
    expect(query.filters).toEqual([
      ["marka", ["atolye"]],
      ["renk", ["mavi"]],
      ["stok", ["var"]],
    ])
    expect(isNarrowed(query)).toBe(true)
    const other = listing("stok=yok&renk=mavi")
    expect([other.isCanonical, listingSearch(other.query)]).toEqual([false, "renk=mavi"])
    expect(facetDisallowLines(KEYS)).toContain("Disallow: /*?stok=")
    // An attribute keyed `stok` is no URL filter: the parameter is the listing's
    expect(filterKeysOf(["stok"]).size).toBe(0)
  })

  it("leaves other parameters where they came, after the listing's", () => {
    const { query, isCanonical } = listing("utm_source=x&renk=mavi&gclid=1")
    expect(isCanonical).toBe(true)
    expect(listingSearch(query)).toBe("renk=mavi&utm_source=x&gclid=1")
  })

  it("reads price, sort and page, and an attribute named like a parameter is none", () => {
    const { query, isCanonical } = listing("fiyat=100-&sirala=fiyat-artan&sayfa=3")
    expect(isCanonical).toBe(true)
    expect(query).toMatchObject({
      filters: [],
      price: { min: 100, max: null },
      sort: "fiyat-artan",
      page: 3,
    })
    expect(KEYS.has("fiyat")).toBe(false)
  })

  it.each([
    [
      "more values than a filter takes",
      `renk=${Array.from({ length: 11 }, (_, i) => `r${String(i)}`).join(",")}`,
    ],
    ["more values than a page takes", "renk=a,b,c,d,e,f,g&malzeme=h,i,j,k,l,m"],
    ["a page past the cap", "sayfa=100000"],
    ["a page number no page has", "sayfa=99999999999999999999"],
  ])("answers nothing for %s", (_label, search) => {
    expect(read(search).kind).toBe("out_of_bounds")
  })

  it("reads an open price range at either end", () => {
    expect(listing("fiyat=-500").query.price).toEqual({ min: null, max: 500 })
    expect(listing("fiyat=-500").isCanonical).toBe(true)
  })

  it("takes no tracking, search or variant parameter for a filter", () => {
    expect([...filterKeysOf(["variant", "q", "utm_source", "gclid", "renk"])]).toEqual(["renk"])
  })

  it("knows a narrowed listing and its single filter", () => {
    expect(isNarrowed(listing("sayfa=2").query)).toBe(false)
    expect(isNarrowed(listing("sirala=yeni").query)).toBe(true)
    expect(singleFilter(listing("malzeme=seramik&sayfa=2").query)).toEqual({
      key: "malzeme",
      value: "seramik",
    })
    expect(singleFilter(listing("malzeme=seramik&sirala=yeni").query)).toBeNull()
    expect(singleFilter(listing("renk=kirmizi,mavi").query)).toBeNull()
  })
})

describe("facet robots lines (KK: facets blocked, landing paths open)", () => {
  const robots = parseRobots(["User-agent: *", ...facetDisallowLines(KEYS)].join("\n"))

  it.each([
    "/kategori/ev?marka=atolye",
    "/kategori/ev?sayfa=2&renk=mavi",
    "/kategori/ev?boy_cm=20",
    "/kategori/ev?sirala=yeni",
    "/marka/atolye?fiyat=100-500",
  ])("keeps crawlers off %s", (path) => {
    expect(isCrawlable(robots, "*", path)).toBe(false)
  })

  it.each([
    "/kategori/ev/seramik",
    "/kategori/ev",
    "/kategori/ev?sayfa=2",
    "/urun/kupa?utm_source=x",
  ])("leaves %s open", (path) => {
    expect(isCrawlable(robots, "*", path)).toBe(true)
  })
})

describe("listing seo", () => {
  const payload = {
    title: "Kupalar | Mağaza",
    description: "",
    canonical: "https://magaza.example.com/kategori/kupalar",
    robots: "index,follow",
    openGraph: {
      title: "Kupalar | Mağaza",
      description: "",
      image: null,
      imageAlt: null,
      type: "website",
      url: "https://magaza.example.com/kategori/kupalar",
      siteName: "Mağaza",
    },
    twitter: { card: "summary", title: "Kupalar | Mağaza", description: "", image: null },
    breadcrumbs: [],
    jsonLd: [],
    hreflang: [],
  } satisfies SeoPayload

  it("names a numbered page canonical and says which page it is", () => {
    const seo = listingSeo(
      {
        ...payload,
        jsonLd: [
          {
            "@type": "CollectionPage",
            name: "Kupalar",
            url: payload.canonical,
            mainEntity: { "@type": "ItemList" },
          },
        ],
      },
      listing("sayfa=3").query,
      "/kategori/kupalar"
    )
    expect(seo).toMatchObject({
      // The storefront titles the page (`lib/seo/paging.ts`)
      title: "Kupalar | Mağaza",
      canonical: "https://magaza.example.com/kategori/kupalar?sayfa=3",
      robots: "index,follow",
      openGraph: { url: "https://magaza.example.com/kategori/kupalar?sayfa=3" },
      jsonLd: [
        {
          "@type": "CollectionPage",
          name: "Kupalar – Sayfa 3",
          url: "https://magaza.example.com/kategori/kupalar?sayfa=3",
        },
      ],
    })
    expect(seo.jsonLd[0]).not.toHaveProperty("mainEntity")
  })

  it("leaves a canonical the page names elsewhere as it is", () => {
    const other = { ...payload, canonical: "https://magaza.example.com/kategori/bardaklar" }
    expect(listingSeo(other, listing("sayfa=2").query, "/kategori/kupalar").canonical).toBe(
      "https://magaza.example.com/kategori/bardaklar"
    )
  })

  it("keeps a filtered or sorted page out of the index, its canonical the clean page", () => {
    const seo = listingSeo(payload, listing("renk=mavi&sayfa=2").query, "/kategori/kupalar")
    expect(seo).toMatchObject({
      robots: "noindex,follow",
      canonical: "https://magaza.example.com/kategori/kupalar",
    })
    expect(
      listingSeo(
        { ...payload, robots: "noindex,nofollow" },
        listing("sirala=yeni").query,
        "/kategori/kupalar"
      ).robots
    ).toBe("noindex,nofollow")
  })
})
