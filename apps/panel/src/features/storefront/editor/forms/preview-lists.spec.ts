import { describe, expect, it } from "vitest"
import type {
  AnySection,
  BannerSection,
  FaqSection,
  HeaderBarSection,
  MarqueeSection,
  PriceBandsSection,
  ProductsSection,
} from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { FIELD_IDS } from "./field-registry"
import { PREVIEW_IDS, previewField } from "./preview-fields"

const faq = (): FaqSection => ({
  ...(newHomeSection("faq", "sss0000001") as FaqSection),
  items: [
    { question: "Kargo?", answer: "Aynı gün." },
    { question: "İade?", answer: "14 gün." },
  ],
})
const marquee = (): MarqueeSection => ({
  ...(newHomeSection("marquee", "kayan00002") as MarqueeSection),
  items: [{ icon: null, text: "Ücretsiz kargo", subtext: "500 TL üstü", link: null }],
})
const banner = (): BannerSection => ({
  ...(newHomeSection("banner", "bant000001") as BannerSection),
  slides: [
    {
      image: { url: "/a.webp", alt: null },
      mobile_image: null,
      heading: "Kış",
      text: null,
      link: null,
      second_link: null,
      tone: "light",
    },
  ],
})
const rail = (id: string, over: Partial<ProductsSection> = {}): ProductsSection => ({
  ...(newHomeSection("products", id) as ProductsSection),
  ...over,
})
const catalogHeader = () =>
  switchVariant(
    {
      id: "mainheader",
      type: "header_bar",
      visible: true,
      starts_at: null,
      ends_at: null,
      variant: "standard",
      sticky: true,
      menu_images: "submenus",
    },
    "catalog"
  ) as HeaderBarSection

const target = (section: AnySection, key: string, context = {}) =>
  previewField(section, key, context)?.target ?? null

/** adr/0065 Faz 2b, the remaining sections: each key the theme marks, and nothing else. */
describe("the preview's register, list rows and one-word fields", () => {
  it("knows a question's and an answer's row by its place in the design", () => {
    expect(target(faq(), "items.1.answer")).toBe(PREVIEW_IDS.text("sss0000001", "items.1.answer"))
    expect(target(faq(), "items.0.question")).toBe("sss0000001-items-0-question")
    expect(target(faq(), "title")).toBe("sss0000001-title")
    // A place the list does not have, a field a row does not show, a part too many
    expect(target(faq(), "items.2.answer")).toBeNull()
    expect(target(faq(), "items.0.image")).toBeNull()
    expect(target(faq(), "items.0.answer.x")).toBeNull()
    expect(target(faq(), "items.01.answer")).toBeNull()
  })

  it("knows a strip's item words, not its link", () => {
    expect(target(marquee(), "items.0.subtext")).toBe("kayan00002-items-0-subtext")
    expect(target(marquee(), "items.0.text")).toBe("kayan00002-items-0-text")
    expect(target(marquee(), "items.0.link")).toBeNull()
  })

  it("knows a band slide's words, picture and both buttons", () => {
    for (const part of ["heading", "text", "image", "link", "second_link"]) {
      expect(target(banner(), `slides.0.${part}`)).toBe(`bant000001-slides-0-${part}`)
    }
    expect(target(banner(), "slides.1.heading")).toBeNull()
    expect(target(banner(), "heading")).toBeNull()
  })

  it("knows a trust badge by the shared list's count", () => {
    const strip = newHomeSection("trust_badges", "guven00001")
    expect(target(strip, "badges.1.text", { badges: 2 })).toBe("guven00001-badges-1-text")
    expect(target(strip, "badges.2.title", { badges: 2 })).toBeNull()
    expect(target(strip, "badges.0.title")).toBeNull()
  })

  it("knows a price band's label and line", () => {
    const bands = newHomeSection("price_bands", "fiyat00001") as PriceBandsSection
    const last = bands.bands.length - 1
    expect(target(bands, `bands.${String(last)}.label`)).toBe(
      `fiyat00001-bands-${String(last)}-label`
    )
    expect(target(bands, `bands.${String(bands.bands.length)}.label`)).toBeNull()
  })

  it("knows a columns rail's more lists, only on a columns rail", () => {
    const lists = [{ title: null, source: { kind: "newest" as const } }]
    const columns = rail("sutun00001", { variant: "columns", lists })
    expect(target(columns, "lists.0.title")).toBe("sutun00001-lists-0-title")
    expect(target(columns, "lists.1.title")).toBeNull()
    expect(target(rail("izgara0001", { lists }), "lists.0.title")).toBeNull()
  })

  it("opens the rail a shelf's pill names, when the shelf agrees with the page", () => {
    const shelf = [rail("raf0000001"), rail("raf0000002"), rail("raf0000003")]
    const [first, second] = shelf
    if (!first || !second) throw new Error("no rail")
    expect(previewField(first, "tabs.2.3", { shelf })).toEqual({
      target: "raf0000003-title",
      group: "content",
      section: "raf0000003",
    })
    // The page drew another count (a rail left out): the shelf's own form only
    expect(previewField(first, "tabs.1.2", { shelf })).toBeNull()
    // Not the shelf's first rail, the first pill (its own title is `title`), no shelf
    expect(previewField(second, "tabs.2.3", { shelf })).toBeNull()
    expect(previewField(first, "tabs.0.3", { shelf })).toBeNull()
    expect(previewField(first, "tabs.1.3")).toBeNull()
  })

  it("knows the new sections' title, line and text body", () => {
    for (const type of ["featured_product", "newsletter", "help"] as const) {
      const section = newHomeSection(type, "kelime0001")
      expect(target(section, "title")).toBe("kelime0001-title")
      expect(target(section, "text")).toBe("kelime0001-text")
    }
    const story = newHomeSection("rich_text", "metin00001")
    expect(target(story, "title")).toBe("metin00001-title")
    expect(target(story, "body")).toBe("metin00001-body")
    expect(target(story, "text")).toBeNull()
    expect(target(newHomeSection("brands", "marka00001"), "text")).toBeNull()
  })

  it("knows the catalog header's search words and highlighted link, on that variant only", () => {
    const header = catalogHeader()
    expect(target(header, "search_placeholder")).toBe(
      FIELD_IDS.header("mainheader", "search_placeholder")
    )
    expect(target(header, "highlight_link")).toBe(FIELD_IDS.header("mainheader", "highlight_link"))
    // The strip's note (Ek 2026-11-15): its words' field, the one the form focuses
    expect(target(header, "strip_note")).toBe(FIELD_IDS.header("mainheader", "strip_note"))
    expect(target(header, "strip_note_link")).toBeNull()
    expect(target(header, "phone")).toBeNull()
    const standard: HeaderBarSection = { ...header, variant: "standard" }
    expect(target(standard, "search_placeholder")).toBeNull()
  })

  it("takes no key shaped as a selector, markup or an object's own name", () => {
    for (const key of ["__proto__", "items.0.__proto__", "items.constructor.answer", "[x]"]) {
      expect(target(faq(), key)).toBeNull()
    }
  })
})
