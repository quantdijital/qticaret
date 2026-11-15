import { describe, expect, it } from "vitest"
import type { HeroCatalogSlide, StoreHeroCatalog } from "@qticaret/types"
import { HERO_CATALOG_SLIDER_DEFAULTS } from "@qticaret/types/section-scroller"
import { t } from "@/lib/i18n"
import { heroCatalogSlides } from "../hero-slides"

const picture = (name: string, alt: string | null = null) => ({
  url: `/static/${name}.webp`,
  alt,
  width: null,
  height: null,
  derivatives: null,
})
const slide = (over: Partial<HeroCatalogSlide> = {}): HeroCatalogSlide => ({
  image: picture("bir"),
  heading: null,
  text: null,
  links: [],
  link: null,
  ...over,
})
const section = (over: Partial<StoreHeroCatalog> = {}): StoreHeroCatalog => ({
  variant: "category_list",
  list: { kind: "top" },
  list_limit: 9,
  show_count: true,
  tiles: [],
  chips: [],
  picks: [],
  show_price: true,
  ...over,
})
const shop = { label: "Mağaza", kind: "system" as const, target: "shop", path: null }

describe("the catalogue opening's slides (adr/0049 Ek 2026-11-15)", () => {
  it("adds nothing for an opening saved before slides: the theme draws its own fields", () => {
    expect(heroCatalogSlides(section(), t)).toEqual({})
  })

  it("passes one slide on without the slider's settings", () => {
    const view = heroCatalogSlides(section({ slides: [slide({ heading: "Yeni" })] }), t)

    expect(view.slider).toBeUndefined()
    expect(view.slides).toEqual([
      expect.objectContaining({ heading: "Yeni", intro: null, actions: [], link: null }),
    ])
    // A picture without words of its own is named by the slide's heading
    expect(view.slides?.[0]?.image?.alt).toBe("Yeni")
  })

  it("turns two or more by themselves unless the shop said otherwise, a speed step as seconds", () => {
    const two = [slide(), slide({ image: picture("iki", "İki"), link: shop, links: [shop] })]

    expect(heroCatalogSlides(section({ slides: two }), t).slider).toEqual({
      settings: HERO_CATALOG_SLIDER_DEFAULTS,
      interval: 6,
    })
    const view = heroCatalogSlides(
      section({
        slides: two,
        scroller: { ...HERO_CATALOG_SLIDER_DEFAULTS, autoplay: "off", speed: "slow" },
      }),
      t
    )
    expect(view.slider).toEqual({
      settings: { ...HERO_CATALOG_SLIDER_DEFAULTS, autoplay: "off", speed: "slow" },
      interval: 8,
    })
    expect(view.slides?.[1]).toMatchObject({
      actions: [{ label: "Mağaza", path: "/magaza" }],
      link: { label: "Mağaza", path: "/magaza" },
    })
  })

  it("drops a slide left with nothing to show", () => {
    const view = heroCatalogSlides(
      section({ slides: [slide({ heading: "Bir" }), slide({ image: null, links: [] })] }),
      t
    )
    expect(view.slides).toHaveLength(1)
    expect(view.slider).toBeUndefined()
  })
})
