import { describe, expect, it } from "vitest"
import { SLIDER_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type {
  AnySection,
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
    const bands = newHomeSection("price_bands", "fiyat00001") as PriceBandsSection
    expect(keys({ ...bands, thumbs: 0 })).toEqual(["thumbs:thumbs"])
    expect(keys({ ...bands, thumbs: 3 })).toEqual(["thumbs:thumbs", "thumbs:thumbs_count"])
  })

  it("names the sliding opening's height and its kit settings, the speed only while it turns", () => {
    const slider = newHomeSection("hero_slider", "slayt00001") as HeroSliderSection
    expect(keys(slider)).toEqual([
      "options:slider_height",
      "scroll:scroller.autoplay",
      "look:scroller.loop",
      "scroll:scroller.arrows",
      "controls:scroller.arrow_style",
      "scroll:scroller.dots",
      "controls:scroller.dot_style",
      "controls:scroller.controls_place",
      "controls:scroller.arrow_size",
      "controls:scroller.controls_tone",
    ])
    const playing = keys({ ...slider, scroller: { ...SLIDER_DEFAULTS, autoplay: "on" } })
    expect(playing).toContain("scroll:scroller.speed")
    expect(playing).toContain("scroll:scroller.play_button")
    // Nothing drawn under the slides: neither the dots' style nor their place
    const bare = keys({
      ...slider,
      scroller: { ...SLIDER_DEFAULTS, dots: "off", arrows: "hidden" },
    })
    expect(bare.filter((key) => key.startsWith("controls:"))).toEqual([])
    // A slider saved before the kit: its switches read as the kit's steps
    const old: HeroSliderSection = { ...slider, autoplay: true }
    delete old.scroller
    expect(keys(old)).toContain("scroll:scroller.speed")
  })

  it("names the FAQ's two switches (bilesen-denetimi (b) 8)", () => {
    expect(keys(newHomeSection("faq", "sss0000001"))).toEqual([
      "opening:open_first",
      "opening:single_open",
    ])
  })

  it("puts the featured product's photographs layout in Diziliş, its steps searchable", () => {
    const featured = newHomeSection("featured_product", "yakin00001")
    expect(keys(featured)).toEqual(["layout:gallery"])
    const [gallery] = contentFields(featured)
    expect(gallery?.options.map((key) => i18next.t(key, { lng: "tr" }))).toEqual([
      "Kolaj",
      "Çapraz şeritler",
    ])
  })

  it("adds the strips' look under it while the strips are chosen (adr/0049 Ek 2026-11-16)", () => {
    const featured = newHomeSection("featured_product", "yakin00001")
    const strips = { ...featured, gallery: "strips" } as AnySection
    expect(keys(strips)).toEqual([
      "layout:gallery",
      "layout:strips_layout",
      "layout:strips_slant",
      "layout:strips_line",
      "layout:strips_overlap",
      "layout:strips_dim",
    ])
    const named = contentFields(strips).map((field) => [
      i18next.t(field.label, { lng: "tr" }),
      i18next.t(field.term ?? "", { lng: "tr" }),
      field.options.map((key) => i18next.t(key, { lng: "tr" })).join(" / "),
    ])
    expect(named.slice(1)).toEqual([
      ["Şeritlerin yeri", "strips_layout", "Yazının yanında / Boydan boya"],
      ["Eğim", "strips_slant", "Hafif / Orta / Keskin"],
      ["Çizgi kalınlığı", "strips_line", "Yok / İnce / Orta / Kalın"],
      ["Üst üste bindir", "strips_overlap", ""],
      ["Diğerlerini karart", "strips_dim", ""],
    ])
  })

  it("names the catalogue opening's list count, product counts and prices", () => {
    const hero = switchVariant(newHomeSection("hero", "giris00001") as HeroSection, "category_list")
    expect(keys(hero)).toEqual([
      "content:slides",
      "categoryList:list_limit",
      "categoryList:show_count",
      "picks:show_price",
    ])
    expect(keys(newHomeSection("hero", "giris00002"))).toEqual([])
    expect(keys(newHomeSection("categories", "kategori01"))).toEqual(["content:show_count"])
  })

  it("names the slider's settings only once the catalogue opening has two slides (Ek 2026-11-15)", () => {
    const hero = switchVariant(newHomeSection("hero", "giris00001") as HeroSection, "category_list")
    const slide = { image: null, heading: "Bir", text: null, links: [], link: null }
    const turning = { ...hero, slides: [slide, { ...slide, heading: "İki" }] } as HeroSection

    expect(keys({ ...hero, slides: [slide] } as HeroSection)).not.toContain(
      "scroll:scroller.autoplay"
    )
    // Still by default (bilesen-standardi §4.5): the speed waits for autoplay
    expect(keys(turning)).toEqual(
      expect.arrayContaining(["scroll:scroller.autoplay", "look:scroller.loop"])
    )
    expect(keys(turning)).not.toContain("scroll:scroller.speed")
    expect(
      keys({ ...turning, scroller: { ...SLIDER_DEFAULTS, autoplay: "on" } } as HeroSection)
    ).toContain("scroll:scroller.speed")
    // Back to today's opening, the slides and their settings go
    expect(
      switchVariant(turning as Extract<HeroSection, { variant: "category_list" }>, "standard")
    ).not.toHaveProperty("slides")
  })

  it("gives every entry a label and a term in both languages, and the forms' element id", () => {
    const sections: AnySection[] = [
      newHomeSection("posts", "blog000001"),
      newBodySection("product", "related_products", "benzer0001"),
      { ...(newHomeSection("price_bands", "fiyat00001") as PriceBandsSection), thumbs: 2 },
      {
        ...(newHomeSection("hero_slider", "slayt00001") as HeroSliderSection),
        scroller: { ...SLIDER_DEFAULTS, autoplay: "on" },
      },
      switchVariant(newHomeSection("hero", "giris00001") as HeroSection, "category_list"),
      newHomeSection("categories", "kategori01"),
      newHomeSection("featured_product", "yakin00001"),
    ]
    for (const section of sections) {
      for (const field of contentFields(section)) {
        for (const lng of ["tr", "en"]) {
          expect(i18next.exists(field.label, { lng }), `${lng} ${field.label}`).toBe(true)
          expect(i18next.exists(field.term ?? "", { lng }), `${lng} ${String(field.term)}`).toBe(
            true
          )
        }
        expect(field.target).toBe(
          field.key.startsWith("scroller.")
            ? FIELD_IDS.scroller(section.id, field.key.slice("scroller.".length) as "dots")
            : FIELD_IDS.content(section.id, field.key as "limit")
        )
      }
    }
  })

  it("is part of the section's search register", () => {
    const posts = newHomeSection("posts", "blog000001")
    expect(sectionFields(posts, "home").map((field) => field.key)).toContain("limit")
  })
})
