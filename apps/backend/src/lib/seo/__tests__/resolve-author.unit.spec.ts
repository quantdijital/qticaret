import { resolveSeoPayload } from "../resolve"
import type { SeoShop, SeoSubject } from "../resolve"

const shop: SeoShop = {
  name: "Demo Mağaza",
  canonicalHost: "magaza.example.com",
  indexing: true,
  titleTemplates: {
    product: "{ürün_adı} | {mağaza}",
    category: "{kategori} | {mağaza}",
    brand: "{marka} | {mağaza}",
    page: "{başlık} | {mağaza}",
    post: "{başlık} | Blog | {mağaza}",
    landing: "{başlık} | {mağaza}",
  },
  descriptionTemplates: { product: "" },
}

const PERSON = {
  name: "Ayşe Yılmaz",
  url: "/blog/yazar/ayse-yilmaz",
  jobTitle: "Bıçak ustası",
  image: "https://cdn.example.com/ayse.webp",
  description: "Yirmi yıldır bıçak biliyor.",
  sameAs: ["https://www.linkedin.com/in/ayse", "https://x.com/ayse"],
}

const author = (overrides: Partial<SeoSubject> = {}): SeoSubject => ({
  kind: "post_author",
  path: "/blog/yazar/ayse-yilmaz",
  name: "Ayşe Yılmaz",
  description: "Yirmi yıldır bıçak biliyor. Atölyede çelik seçimi ve bileme üzerine yazıyor.",
  tokens: {},
  overrides: null,
  image: { url: "https://cdn.example.com/ayse.webp", alt: "Ayşe Yılmaz" },
  trail: [{ name: "Blog", path: "/blog" }],
  profile: { person: PERSON, dateModified: "2026-11-05T10:00:00.000Z" },
  ...overrides,
})

describe("a blog author's page (adr/0060)", () => {
  it("is titled as a post is and described by the bio, under the blog", () => {
    const payload = resolveSeoPayload(author(), shop)
    expect(payload.title).toBe("Ayşe Yılmaz | Blog | Demo Mağaza")
    expect(payload.description).toBe(
      "Yirmi yıldır bıçak biliyor. Atölyede çelik seçimi ve bileme üzerine yazıyor."
    )
    expect(payload.canonical).toBe("https://magaza.example.com/blog/yazar/ayse-yilmaz")
    expect(payload.breadcrumbs.map((crumb) => crumb.name)).toEqual(["Blog", "Ayşe Yılmaz"])
  })

  it("is a ProfilePage about the Person, with their page absolute and their own pages", () => {
    const [profile, trail] = resolveSeoPayload(author(), shop).jsonLd
    expect(profile).toEqual({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: "Ayşe Yılmaz",
      description: "Yirmi yıldır bıçak biliyor. Atölyede çelik seçimi ve bileme üzerine yazıyor.",
      url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
      dateModified: "2026-11-05T10:00:00.000Z",
      mainEntity: {
        "@type": "Person",
        name: "Ayşe Yılmaz",
        url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
        jobTitle: "Bıçak ustası",
        image: "https://cdn.example.com/ayse.webp",
        description: "Yirmi yıldır bıçak biliyor.",
        sameAs: ["https://www.linkedin.com/in/ayse", "https://x.com/ayse"],
      },
    })
    expect(trail?.["@type"]).toBe("BreadcrumbList")
  })

  it("leaves empty facts out of the Person", () => {
    const [profile] = resolveSeoPayload(
      author({
        profile: {
          person: { name: "Ayşe Yılmaz", url: "/blog/yazar/ayse-yilmaz", sameAs: [] },
          dateModified: null,
        },
      }),
      shop
    ).jsonLd
    expect(profile?.["mainEntity"]).toEqual({
      "@type": "Person",
      name: "Ayşe Yılmaz",
      url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
    })
  })

  it("names a post's author as the Person with their page (adr/0060)", () => {
    const post: SeoSubject = {
      kind: "post",
      path: "/blog/bicak-bileme",
      name: "Bıçak nasıl bilenir?",
      description: "Bileme taşı seçimi.",
      tokens: {},
      overrides: null,
      image: null,
      trail: [{ name: "Blog", path: "/blog" }],
      article: {
        type: "BlogPosting",
        headline: "Bıçak nasıl bilenir?",
        datePublished: "2026-11-01T00:00:00.000Z",
        dateModified: null,
        author: PERSON,
        image: null,
      },
    }
    const [article] = resolveSeoPayload(post, shop).jsonLd
    expect(article?.["author"]).toEqual({
      "@type": "Person",
      name: "Ayşe Yılmaz",
      url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
      jobTitle: "Bıçak ustası",
      image: "https://cdn.example.com/ayse.webp",
      description: "Yirmi yıldır bıçak biliyor.",
      sameAs: ["https://www.linkedin.com/in/ayse", "https://x.com/ayse"],
    })
  })
})
