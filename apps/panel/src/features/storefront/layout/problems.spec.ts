import { describe, expect, it } from "vitest"
import type {
  AnySection,
  CategorySection,
  FaqSection,
  FeaturedProductSection,
  HeroSection,
  HeroSliderSection,
  LayoutDocument,
  ProductSection,
  ProductsSection,
} from "@/features/storefront/api/layout"
import { previewAddress } from "./preview-url"
import { documentProblems, sectionProblems } from "./problems"
import { fromLocalInput, toLocalInput } from "./schedule"
import { newAnnouncementBar, newBodySection, newHomeSection } from "./sections"

describe("sectionProblems", () => {
  it("finds what the server would refuse, field by field", () => {
    expect(
      sectionProblems({
        ...newAnnouncementBar("duyurular"),
        lines: ["", "{kargo} bedava", "Tamam"],
      })
    ).toEqual({ "lines.0": "required", "lines.1": "tokenUnknown" })
    expect(
      sectionProblems({
        ...(newHomeSection("hero", "girisbolumu") as HeroSection),
        heading: "x".repeat(91),
        text: "Bize {telefon} ile ulaşın",
        links: [{ kind: "url", url: "https://example.com", label: " " }],
      })
    ).toEqual({ heading: "tooLong", "links.0": "linkLabel" })
    expect(sectionProblems(newHomeSection("banner", "kampanya"))).toEqual({
      slides: "slidesRequired",
    })
  })

  it("asks a hero slider for two slides and checks each slide's words (adr/0049 Ek 2026-11-06)", () => {
    const slider = newHomeSection("hero_slider", "kayangiris") as HeroSliderSection
    expect(slider).toMatchObject({ autoplay: false, interval: 6, height: "regular" })
    expect(sectionProblems(slider)).toEqual({ slides: "slidesTwo" })
    const slide = {
      image: { url: "/static/bir.webp", alt: null },
      mobile_image: { url: "/static/dar.webp", alt: "x".repeat(301) },
      heading: "{kargo} bedava",
      text: null,
      link: { kind: "url" as const, url: "https://example.com", label: "" },
      position: "left" as const,
      tone: "light" as const,
    }
    expect(
      sectionProblems({
        ...slider,
        slides: [slide, { ...slide, mobile_image: null, heading: null, link: null }],
      })
    ).toEqual({
      "slides.0.mobile_image": "tooLong",
      "slides.0.heading": "tokenUnknown",
      "slides.0.link": "linkLabel",
    })
  })

  it("asks for what a product source needs, and an end after the start", () => {
    const products = newHomeSection("products", "yeniurunler") as ProductsSection
    expect(sectionProblems(products)).toEqual({})
    expect(sectionProblems({ ...products, source: { kind: "manual", product_ids: [] } })).toEqual({
      source: "productsRequired",
    })
    expect(sectionProblems({ ...products, source: { kind: "category", category_id: "" } })).toEqual(
      { source: "categoryRequired" }
    )
    // A best-seller window of a week to a year; a sale list needs nothing chosen
    for (const days of [7, 90, 365]) {
      expect(sectionProblems({ ...products, source: { kind: "best_sellers", days } })).toEqual({})
    }
    expect(sectionProblems({ ...products, source: { kind: "best_sellers", days: 6 } })).toEqual({
      days: "daysRange",
    })
    expect(sectionProblems({ ...products, source: { kind: "on_sale" } })).toEqual({})
    expect(
      sectionProblems({
        ...products,
        starts_at: "2026-11-20T09:00:00.000Z",
        ends_at: "2026-11-20T09:00:00.000Z",
      })
    ).toEqual({ schedule: "scheduleOrder" })
  })

  it("maps the document's sections with problems by id", () => {
    const doc: LayoutDocument = {
      header: [newAnnouncementBar("duyurular")],
      home: [newHomeSection("hero", "girisbolumu")],
      footer: [],
      product: [newBodySection("product", "faq", "urunsss") as ProductSection],
      category: [newBodySection("category", "rich_text", "kategorimetni") as CategorySection],
    }
    expect([...documentProblems(doc).keys()]).toEqual(["duyurular", "urunsss"])
  })

  it("asks for each question and answer of a FAQ, its answer may hold the shop's details", () => {
    const faq = newHomeSection("faq", "sss") as FaqSection
    expect(sectionProblems(faq)).toEqual({
      "items.0.question": "questionRequired",
      "items.0.answer": "answerRequired",
    })
    expect(
      sectionProblems({
        ...faq,
        items: [
          { question: "Kargo ne kadar sürer?", answer: "{telefon} numarasından sorun." },
          { question: "x".repeat(161), answer: "{bilinmeyen}" },
        ],
      })
    ).toEqual({ "items.1.question": "tooLong", "items.1.answer": "tokenUnknown" })
  })

  it("asks a related products section for its collection or products", () => {
    const related = newBodySection("product", "related_products", "benzerler")
    expect(sectionProblems(related)).toEqual({})
    expect(
      sectionProblems({ ...related, source: { kind: "manual", product_ids: [] } } as AnySection)
    ).toEqual({ source: "productsRequired" })
    expect(
      sectionProblems({
        ...related,
        source: { kind: "collection", collection_id: "" },
      } as AnySection)
    ).toEqual({ source: "collectionRequired" })
  })

  it("asks a featured product section for its product, and checks its line (adr/0046 Ek 2026-11-05)", () => {
    const featured = newHomeSection("featured_product", "yakinbakis") as FeaturedProductSection
    expect(featured).toMatchObject({ title: null, text: null, product_id: "" })
    expect(sectionProblems(featured)).toEqual({ product_id: "productRequired" })
    expect(
      sectionProblems({ ...featured, product_id: "prod_1", text: "Sorular için {telefon}" })
    ).toEqual({})
    expect(sectionProblems({ ...featured, product_id: "prod_1", text: "{bilinmeyen}" })).toEqual({
      text: "tokenUnknown",
    })
  })
})

describe("schedule fields", () => {
  it("turns a local moment into an ISO one and back", () => {
    const iso = fromLocalInput("2026-11-20T09:30")
    expect(iso).toBe(new Date(2026, 10, 20, 9, 30).toISOString())
    expect(toLocalInput(iso)).toBe("2026-11-20T09:30")
    expect(fromLocalInput("")).toBeNull()
    expect(toLocalInput(null)).toBe("")
    expect(toLocalInput("not a date")).toBe("")
  })
})

describe("previewAddress", () => {
  const preview = { url: "/onizleme/sfl_abc", path: "/onizleme/sfl_abc" }

  it("puts the signed path on the storefront's origin when one is known", () => {
    expect(previewAddress(preview, "http://localhost:8000")).toBe(
      "http://localhost:8000/onizleme/sfl_abc"
    )
  })

  it("uses the server's link when it is absolute, and none when it is not", () => {
    const absolute = { ...preview, url: "https://ornek.com/onizleme/sfl_abc" }
    expect(previewAddress(absolute, null)).toBe("https://ornek.com/onizleme/sfl_abc")
    expect(previewAddress(preview, null)).toBeNull()
  })

  it("asks for a product's or category's page with the draft by its path", () => {
    expect(previewAddress(preview, "http://localhost:8000", "/urun/sef-bicagi")).toBe(
      "http://localhost:8000/onizleme/sfl_abc?sayfa=%2Furun%2Fsef-bicagi"
    )
    const absolute = { ...preview, url: "https://ornek.com/onizleme/sfl_abc" }
    expect(previewAddress(absolute, null, "/kategori/mutfak")).toBe(
      "https://ornek.com/onizleme/sfl_abc?sayfa=%2Fkategori%2Fmutfak"
    )
  })
})
