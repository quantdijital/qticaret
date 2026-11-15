import { describe, expect, it } from "vitest"
import type {
  AnySection,
  HeroSection,
  HeroSliderSection,
  LayoutLink,
} from "@/features/storefront/api/layout"
import { newAnnouncementBar, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { PREVIEW_IDS, previewField } from "./preview-fields"
import type { CatalogHero } from "./slider-kit"

const link: LayoutLink = { kind: "url", url: "https://a.example", label: "Tümü" }

const hero = (over: Partial<HeroSection> = {}) =>
  ({ ...newHomeSection("hero", "giris00001"), links: [link], ...over }) as HeroSection
const catalog = (over: Partial<CatalogHero> = {}): CatalogHero => ({
  ...(switchVariant(hero(), "category_list") as CatalogHero),
  ...over,
})
const slider = (): HeroSliderSection => ({
  ...(newHomeSection("hero_slider", "kayan00001") as HeroSliderSection),
  slides: [
    {
      image: { url: "/a.webp", alt: null },
      mobile_image: null,
      heading: "Bir",
      text: null,
      link: null,
      position: "left",
      tone: "light",
    },
  ],
})
const slide = (links: LayoutLink[]) => ({
  image: null,
  heading: "Kamp",
  text: null,
  links,
  link: null,
})

/** The preview's field register (adr/0065 §9, Faz 2b): known keys only, part by part. */
describe("the preview's field register", () => {
  it("places the opening's own words, buttons and picture", () => {
    for (const key of ["eyebrow", "heading", "text", "image", "links.0"]) {
      expect(previewField(hero(), key)).toEqual({
        target: PREVIEW_IDS.text("giris00001", key),
        group: "content",
      })
    }
    expect(PREVIEW_IDS.text("giris00001", "links.0")).toBe("giris00001-links-0")
  })

  it("knows no button the opening does not have, nor a part it has not", () => {
    for (const key of [
      "links.1",
      "links.01",
      "links",
      "links.0.label",
      "title",
      "slides.0.heading",
    ]) {
      expect(previewField(hero(), key)).toBeNull()
    }
  })

  it("opens a catalogue opening's slide at its field, saved before slides or after", () => {
    // Before slides: the opening's own words are its first slide's
    expect(previewField(catalog(), "heading")).toEqual({
      target: "giris00001-slide-0-heading",
      group: "content",
      slide: 0,
    })
    expect(previewField(catalog(), "links.0")).toMatchObject({
      target: "giris00001-slide-0-button-0",
    })
    // The line above is the opening's, outside the slides
    expect(previewField(catalog(), "eyebrow")).toEqual({
      target: "giris00001-eyebrow",
      group: "content",
    })
    const two = catalog({ slides: [slide([]), slide([link, link])] })
    expect(previewField(two, "slides.1.links.1")).toEqual({
      target: "giris00001-slide-1-button-1",
      group: "content",
      slide: 1,
    })
    expect(previewField(two, "slides.1.image")).toMatchObject({
      target: "giris00001-slide-1-image",
    })
    expect(previewField(two, "slides.0.links.0")).toBeNull()
    expect(previewField(two, "slides.2.heading")).toBeNull()
    expect(previewField(two, "slides.1.links.2")).toBeNull()
  })

  it("opens a sliding opening's slide at its field", () => {
    expect(previewField(slider(), "slides.0.link")).toEqual({
      target: "hero-slide-0-link",
      group: "content",
      slide: 0,
    })
    expect(previewField(slider(), "slides.1.heading")).toBeNull()
    expect(previewField(slider(), "slides.0.links.0")).toBeNull()
    expect(previewField(slider(), "heading")).toBeNull()
  })

  it("places an announcement's line, and a section's title where the theme marks it", () => {
    const bar = { ...newAnnouncementBar("duyuru0001"), lines: ["Bir", "İki"] }
    expect(previewField(bar, "lines.1")).toEqual({
      target: "duyuru0001-lines-1",
      group: "content",
    })
    expect(previewField(bar, "lines.2")).toBeNull()
    const brands = newHomeSection("brands", "marka00001") as AnySection
    expect(previewField(brands, "title")).toEqual({ target: "marka00001-title", group: "content" })
    const faq = newHomeSection("faq", "sss0000001") as AnySection
    expect(previewField(faq, "title")).toBeNull()
  })

  it("never takes a key of another form, however it looks", () => {
    for (const key of ['"]{}', "<b>", "__proto__", "constructor", "", ".", "a".repeat(81)]) {
      expect(previewField(hero(), key)).toBeNull()
      expect(previewField(catalog(), key)).toBeNull()
    }
  })
})
