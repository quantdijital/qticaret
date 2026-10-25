import { excerpt, plainText, priceSentence, resolveSeoPayload } from "../resolve"
import type { SeoShop, SeoSubject } from "../resolve"

const shop: SeoShop = {
  name: "Demo Mağaza",
  canonicalHost: "magaza.example.com",
  titleTemplates: {
    product: "{ürün_adı} | {marka} | {mağaza}",
    category: "{kategori} Modelleri ve Fiyatları | {mağaza}",
    brand: "{marka} Ürünleri | {mağaza}",
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
      jsonLd: [],
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
