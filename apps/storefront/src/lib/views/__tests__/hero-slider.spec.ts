import { describe, expect, it } from "vitest"
import type { StoreHeroSliderSection } from "@qticaret/types"
import { SLIDER_DEFAULTS } from "@qticaret/types/section-scroller"
import { t } from "@/lib/i18n"
import { heroSliderView } from "../hero-slider"

const picture = (name: string) => ({
  url: `/static/${name}.webp`,
  alt: null,
  width: null,
  height: null,
  derivatives: null,
})
const section = (over: Partial<StoreHeroSliderSection> = {}): StoreHeroSliderSection => ({
  id: "kayan0001",
  type: "hero_slider",
  slides: ["bir", "iki"].map((name) => ({
    image: picture(name),
    mobile_image: null,
    heading: null,
    text: null,
    link: null,
    position: "left" as const,
    tone: "light" as const,
  })),
  height: "regular",
  ...over,
})

describe("the hero slider's kit settings (bilesen-denetimi (b) 4)", () => {
  it("passes the kit's settings on, each speed step as the slider's own seconds", () => {
    const view = heroSliderView(
      section({ scroller: { ...SLIDER_DEFAULTS, autoplay: "on", speed: "slow", loop: "off" } }),
      t
    )
    expect(view.settings).toEqual({
      ...SLIDER_DEFAULTS,
      autoplay: "on",
      speed: "slow",
      loop: "off",
    })
    expect(view.interval).toBe(8)
    expect(heroSliderView(section(), t)).toMatchObject({ settings: SLIDER_DEFAULTS, interval: 6 })
  })

  it("plays seconds no step keeps as saved, and reads a backend from before the kit", () => {
    expect(
      heroSliderView(section({ scroller: { ...SLIDER_DEFAULTS, autoplay: "on" }, interval: 7 }), t)
        .interval
    ).toBe(7)
    const old = heroSliderView(
      section({ autoplay: true, interval: 10, dots: false, arrows: false }),
      t
    )
    expect(old.settings).toEqual({
      ...SLIDER_DEFAULTS,
      autoplay: "on",
      speed: "slow",
      dots: "off",
      arrows: "hidden",
    })
    expect(old.interval).toBe(10)
  })
})
