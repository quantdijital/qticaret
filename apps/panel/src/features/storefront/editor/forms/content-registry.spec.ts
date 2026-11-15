import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import type {
  AnySection,
  GoogleRatingSection,
  HeroSection,
  HeroSliderSection,
  PriceBandsSection,
  ProductsSection,
} from "@/features/storefront/api/layout"
import { newBodySection, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { contentFields } from "./content-registry"
import { FIELD_IDS, sectionFields } from "./field-registry"

const keys = (section: AnySection) =>
  contentFields(section).map((field) => `${field.group}:${field.key}`)

/** docs/tema/bilesen-denetimi O2, O3: the content fields in the settings search, each with its term. */
describe("the content fields' register", () => {
  it("names a list's count, and a grid or carousel rail's only", () => {
    expect(keys(newHomeSection("posts", "blog000001"))).toEqual(["content:limit"])
    expect(keys(newHomeSection("reviews", "yorum00001"))).toEqual(["content:limit"])
    const rail = newHomeSection("products", "raf0000001") as ProductsSection
    expect(keys(rail)).toEqual(["content:limit"])
    expect(keys(switchVariant(rail, "compact"))).toEqual([])
  })

  it("puts related products' columns (wide, phone) and card in Diziliş beside their count", () => {
    expect(keys(newBodySection("product", "related_products", "benzer0001"))).toEqual([
      "content:limit",
      "layout:columns",
      "layout:columns_mobile",
      "layout:card_variant",
    ])
  })

  it("gives related products in a carousel the scroller's fields, no columns (denetim (b) 7)", () => {
    const related = newBodySection("product", "related_products", "benzer0001")
    if (related.type !== "related_products") throw new Error("not related")
    const found = keys(switchVariant(related, "carousel"))
    expect(found).not.toContain("layout:columns")
    expect(found).toContain("layout:card_variant")
    expect(found).toContain("scroll:scroller.arrows")
    expect(found).toContain("look:scroller.loop")
  })

  it("follows the switches: a count only while it is on", () => {
    const rating = newHomeSection("google_rating", "google0001") as GoogleRatingSection
    expect(keys({ ...rating, excerpts: 0 })).toEqual(["content:excerpts", "content:profile_link"])
    expect(keys({ ...rating, excerpts: 2 })).toContain("content:excerpt_count")
    const bands = newHomeSection("price_bands", "fiyat00001") as PriceBandsSection
    expect(keys({ ...bands, thumbs: 0 })).toEqual(["content:thumbs"])
    expect(keys({ ...bands, thumbs: 3 })).toEqual(["content:thumbs", "content:thumbs_count"])
  })

  it("names the sliding opening's options, the seconds only while it turns by itself", () => {
    const slider = newHomeSection("hero_slider", "slayt00001") as HeroSliderSection
    expect(keys({ ...slider, autoplay: false })).toEqual([
      "content:slider_height",
      "content:autoplay",
      "content:dots",
      "content:arrows",
    ])
    expect(keys({ ...slider, autoplay: true })).toContain("content:interval")
  })

  it("names the FAQ's two switches (bilesen-denetimi (b) 8)", () => {
    expect(keys(newHomeSection("faq", "sss0000001"))).toEqual([
      "content:open_first",
      "content:single_open",
    ])
  })

  it("names the catalogue opening's list count, product counts and prices", () => {
    const hero = switchVariant(newHomeSection("hero", "giris00001") as HeroSection, "category_list")
    expect(keys(hero)).toEqual(["content:list_limit", "content:show_count", "content:show_price"])
    expect(keys(newHomeSection("hero", "giris00002"))).toEqual([])
    expect(keys(newHomeSection("categories", "kategori01"))).toEqual(["content:show_count"])
  })

  it("gives every entry a label and a term in both languages, and the forms' element id", () => {
    const sections: AnySection[] = [
      newHomeSection("posts", "blog000001"),
      newBodySection("product", "related_products", "benzer0001"),
      { ...(newHomeSection("google_rating", "google0001") as GoogleRatingSection), excerpts: 2 },
      { ...(newHomeSection("price_bands", "fiyat00001") as PriceBandsSection), thumbs: 2 },
      { ...(newHomeSection("hero_slider", "slayt00001") as HeroSliderSection), autoplay: true },
      switchVariant(newHomeSection("hero", "giris00001") as HeroSection, "category_list"),
      newHomeSection("categories", "kategori01"),
    ]
    for (const section of sections) {
      for (const field of contentFields(section)) {
        for (const lng of ["tr", "en"]) {
          expect(i18next.exists(field.label, { lng }), `${lng} ${field.label}`).toBe(true)
          expect(i18next.exists(field.term ?? "", { lng }), `${lng} ${String(field.term)}`).toBe(
            true
          )
        }
        expect(field.target).toBe(FIELD_IDS.content(section.id, field.key as "limit"))
      }
    }
  })

  it("is part of the section's search register", () => {
    const posts = newHomeSection("posts", "blog000001")
    expect(sectionFields(posts, "home").map((field) => field.key)).toContain("limit")
  })
})
