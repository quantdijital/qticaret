import { excerpt, plainText, priceSentence, resolveSeoPayload } from "../resolve"
import type { SeoShop, SeoSubject } from "../resolve"

const shop: SeoShop = {
  name: "Demo Mağaza",
  canonicalHost: "magaza.example.com",
  indexing: true,
  titleTemplates: {
    product: "{ürün_adı} | {marka} | {mağaza}",
    category: "{kategori} Modelleri ve Fiyatları | {mağaza}",
    brand: "{marka} Ürünleri | {mağaza}",
    page: "{başlık} | {mağaza}",
    post: "{başlık} | {mağaza}",
    landing: "{başlık} | {mağaza}",
  },
  descriptionTemplates: { product: "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}" },
}

const product = (overrides: Partial<SeoSubject> = {}): SeoSubject => ({
  kind: "product",
  path: "/urun/keten-gomlek",
  name: "Keten Gömlek",
  description: "<p>Yıkanmış ketenden rahat kesim gömlek.</p>",
  tokens: {
    kısa_açıklama: "Yıkanmış ketenden rahat kesim gömlek",
    fiyat_cümlesi: "899,00 TL.",
    marka: null,
    kargo_cümlesi: "",
  },
  overrides: null,
  image: { url: "https://cdn.example.com/gomlek.webp", alt: null },
  trail: [
    { name: "Giyim", path: "/kategori/giyim" },
    { name: "Gömlek", path: "/kategori/giyim/gomlek" },
  ],
  ...overrides,
})

describe("resolveSeoPayload", () => {
  it("fills empty fields from the templates, absolute on the canonical host", () => {
    expect(resolveSeoPayload(product(), shop)).toEqual({
      title: "Keten Gömlek | Demo Mağaza",
      description: "Yıkanmış ketenden rahat kesim gömlek. 899,00 TL.",
      canonical: "https://magaza.example.com/urun/keten-gomlek",
      robots: "index,follow",
      openGraph: {
        title: "Keten Gömlek | Demo Mağaza",
        description: "Yıkanmış ketenden rahat kesim gömlek. 899,00 TL.",
        image: "https://cdn.example.com/gomlek.webp",
        imageAlt: "Keten Gömlek",
        type: "product",
        url: "https://magaza.example.com/urun/keten-gomlek",
        siteName: "Demo Mağaza",
      },
      twitter: {
        card: "summary_large_image",
        title: "Keten Gömlek | Demo Mağaza",
        description: "Yıkanmış ketenden rahat kesim gömlek. 899,00 TL.",
        image: "https://cdn.example.com/gomlek.webp",
      },
      breadcrumbs: [
        { name: "Giyim", url: "https://magaza.example.com/kategori/giyim" },
        { name: "Gömlek", url: "https://magaza.example.com/kategori/giyim/gomlek" },
        { name: "Keten Gömlek", url: "https://magaza.example.com/urun/keten-gomlek" },
      ],
      // The subject has no product facts here: only its breadcrumbs (F3.12)
      jsonLd: [expect.objectContaining({ "@type": "BreadcrumbList" })],
      hreflang: [],
    })
  })

  it("takes the page's own fields first", () => {
    const payload = resolveSeoPayload(
      product({
        overrides: {
          seo_title: "Keten Gömlek | Yazlık",
          seo_description: "Yaz için keten.",
          canonical_override: "/urun/keten-gomlek-beyaz",
          robots_override: "noindex_follow",
          og_image_alt: "Beyaz keten gömlek",
        },
      }),
      shop
    )
    expect(payload).toMatchObject({
      title: "Keten Gömlek | Yazlık",
      description: "Yaz için keten.",
      canonical: "https://magaza.example.com/urun/keten-gomlek-beyaz",
      robots: "noindex,follow",
      openGraph: { imageAlt: "Beyaz keten gömlek" },
    })
  })

  it("says noindex on every page of an instance that must stay out of search", () => {
    expect(resolveSeoPayload(product(), { ...shop, indexing: false }).robots).toBe(
      "noindex,nofollow"
    )
  })

  it("has no canonical without a host, and paths for breadcrumbs", () => {
    const payload = resolveSeoPayload(product({ trail: [] }), { ...shop, canonicalHost: null })
    expect(payload.canonical).toBeNull()
    expect(payload.breadcrumbs).toEqual([{ name: "Keten Gömlek", url: "/urun/keten-gomlek" }])
  })

  it("titles a category from its template and describes it from its own text", () => {
    const payload = resolveSeoPayload(
      {
        ...product(),
        kind: "category",
        path: "/kategori/giyim",
        name: "Giyim",
        description: "Keten ve pamuklu giyim ürünleri.",
        tokens: {},
        image: null,
        trail: [],
      },
      shop
    )
    expect(payload).toMatchObject({
      title: "Giyim Modelleri ve Fiyatları | Demo Mağaza",
      description: "Keten ve pamuklu giyim ürünleri.",
      openGraph: { type: "website", image: null, imageAlt: null },
      twitter: { card: "summary" },
    })
  })

  it("titles a brand from its own template", () => {
    const payload = resolveSeoPayload(
      { ...product(), kind: "brand", path: "/marka/ornek", name: "Örnek", tokens: {}, trail: [] },
      shop
    )
    expect(payload.title).toBe("Örnek Ürünleri | Demo Mağaza")
    expect(payload.openGraph.type).toBe("website")
  })

  it("falls back to the description when the template renders nothing", () => {
    const payload = resolveSeoPayload(product({ tokens: {} }), {
      ...shop,
      descriptionTemplates: { product: "{fiyat_cümlesi}" },
    })
    expect(payload.description).toBe("Yıkanmış ketenden rahat kesim gömlek.")
  })
})

describe("content pages (F3.16)", () => {
  const post = (kind: "page" | "post"): SeoSubject => ({
    kind,
    path: kind === "post" ? "/blog/kupa-secimi" : "/hakkimizda",
    name: "Kupa nasıl seçilir?",
    description: "Seramik mi porselen mi? Kullanım ve bakıma göre seçim.",
    tokens: {},
    overrides: null,
    image: { url: "https://cdn.example.com/kapak.webp", alt: null },
    trail: kind === "post" ? [{ name: "Blog", path: "/blog" }] : [],
    article: {
      type: kind === "post" ? "BlogPosting" : "WebPage",
      headline: "Kupa nasıl seçilir?",
      datePublished: "2026-10-20T09:00:00.000Z",
      dateModified: "2026-10-25T09:00:00.000Z",
      author: "Ayşe Yılmaz",
      image: "https://cdn.example.com/kapak.webp",
    },
  })

  it("makes a blog post an article with its author and dates", () => {
    const seo = resolveSeoPayload(post("post"), shop)
    expect(seo.title).toBe("Kupa nasıl seçilir? | Demo Mağaza")
    expect(seo.openGraph.type).toBe("article")
    expect(seo.breadcrumbs.map((crumb) => crumb.url)).toEqual([
      "https://magaza.example.com/blog",
      "https://magaza.example.com/blog/kupa-secimi",
    ])
    expect(seo.jsonLd[0]).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Kupa nasıl seçilir?",
      description: "Seramik mi porselen mi? Kullanım ve bakıma göre seçim.",
      url: "https://magaza.example.com/blog/kupa-secimi",
      mainEntityOfPage: "https://magaza.example.com/blog/kupa-secimi",
      image: ["https://cdn.example.com/kapak.webp"],
      datePublished: "2026-10-20T09:00:00.000Z",
      dateModified: "2026-10-25T09:00:00.000Z",
      author: { "@type": "Person", name: "Ayşe Yılmaz" },
      publisher: { "@type": "Organization", name: "Demo Mağaza" },
    })
  })

  it("makes a content page a web page", () => {
    const seo = resolveSeoPayload(post("page"), shop)
    expect(seo.openGraph.type).toBe("website")
    expect(seo.jsonLd[0]).toMatchObject({ "@type": "WebPage", name: "Kupa nasıl seçilir?" })
  })
})

describe("text helpers", () => {
  it("cuts at a word, without a dangling joiner", () => {
    expect(excerpt("Bir iki üç dört, beş altı", 17)).toBe("Bir iki üç dört")
    expect(excerpt("<b>Kısa</b> metin", 50)).toBe("Kısa metin")
  })

  it("drops tags and entities", () => {
    expect(plainText("<p>Bir&nbsp;iki</p>\n<p>üç</p>")).toBe("Bir iki üç")
  })

  it("says one price or where a range starts", () => {
    expect(priceSentence([899, 899])).toBe("899,00 TL.")
    expect(priceSentence([1250, 999.5, 0])).toBe("999,50 TL'den başlayan fiyatlarla.")
    expect(priceSentence([])).toBe("")
  })
})

describe("blog archives and the sale page (adr/0019 ek 2026-11-03)", () => {
  const listing = (overrides: Partial<SeoSubject>): SeoSubject => ({
    kind: "post_category",
    path: "/blog/kategori/bakim",
    name: "Bakım",
    description: "Bakım üzerine yazılar.",
    tokens: {},
    overrides: null,
    image: null,
    trail: [{ name: "Blog", path: "/blog" }],
    ...overrides,
  })

  it("titles a category's or tag's archive with the post template, under the blog", () => {
    const shopWithPostTemplate = {
      ...shop,
      titleTemplates: { ...shop.titleTemplates, post: "{başlık} – Blog | {mağaza}" },
    }
    for (const kind of ["post_category", "post_tag"] as const) {
      const seo = resolveSeoPayload(listing({ kind }), shopWithPostTemplate)
      expect(seo.title).toBe("Bakım – Blog | Demo Mağaza")
      expect(seo.openGraph.type).toBe("website")
      expect(seo.breadcrumbs.map((crumb) => crumb.name)).toEqual(["Blog", "Bakım"])
    }
  })

  it("titles the sale page by its name and the shop's, whatever the templates", () => {
    const seo = resolveSeoPayload(
      listing({
        kind: "sale",
        path: "/kampanyalar",
        name: "Kampanyalı ürünler",
        trail: [],
        listing: [{ name: "Keten Gömlek", path: "/urun/keten-gomlek" }],
      }),
      shop
    )
    expect(seo.title).toBe("Kampanyalı ürünler | Demo Mağaza")
    expect(seo.canonical).toBe("https://magaza.example.com/kampanyalar")
    expect(seo.jsonLd.map((block) => block["@type"])).toEqual(["CollectionPage"])
  })
})
