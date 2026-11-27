import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, base, image, optional, text } from "../layout-fields"
import { storefrontLink } from "../menus"

/**
 * The top image slider (`top_slider`, owner 2026-11-27): a full-width band
 * of the shop's pictures above the header, one at a time (pt.com.tr's top
 * bar), in the header group beside the text strip and the scrolling
 * strip, at most once. A type of its own: none of the text strip's parts
 * (no phone, links or account). Each slide a wide picture with its words
 * for screen readers, a phone's own crop optional, and one optional link.
 * No slides: nothing drawn (a new one is added empty, then filled). Its
 * height a named step the theme maps (`thin` 48, `medium` 80, `tall` 120
 * px wide, scaled on a phone), so the band's room is held from the first
 * paint. It turns by itself every `interval` (8 / 6 / 4 s), sliding or
 * fading; the theme stops it on hover, focus and reduced motion.
 */
export const TOP_SLIDER_SETTINGS = {
  height: ["thin", "medium", "tall"],
  interval: ["slow", "medium", "fast"],
  transition: ["slide", "fade"],
  arrows: ["on", "off"],
  dots: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof TOP_SLIDER_SETTINGS

/** A new slider's steps. */
export const TOP_SLIDER_DEFAULTS: {
  readonly [S in Setting]: (typeof TOP_SLIDER_SETTINGS)[S][number]
} = {
  height: "thin",
  interval: "medium",
  transition: "slide",
  arrows: "on",
  dots: "off",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = TOP_SLIDER_SETTINGS[name]
  return z
    .custom<(typeof TOP_SLIDER_SETTINGS)[S][number]>(
      (value) => steps.includes(value),
      SETTING_ERROR
    )
    .default(TOP_SLIDER_DEFAULTS[name])
}

/** A picture whose words for screen readers are written: a slide is its picture alone. */
const described = image.extend({ alt: text(300) })

export const topSlide = z
  .object({
    image: described,
    /** A phone's own picture (a closer crop); none: the wide one. */
    mobile_image: optional(image),
    link: optional(storefrontLink),
  })
  .strict()

export const topSlider = z
  .object({
    ...base,
    type: z.literal("top_slider"),
    slides: z.array(topSlide).max(LAYOUT_LIMITS.slides).default([]),
    height: setting("height"),
    interval: setting("interval"),
    transition: setting("transition"),
    arrows: setting("arrows"),
    dots: setting("dots"),
  })
  .strict()

export type TopSlider = z.infer<typeof topSlider>

/** Every picture the slider shows: each slide's, and a phone's own where it has one. */
export const topSliderImages = (section: TopSlider): string[] =>
  section.slides.flatMap((slide) =>
    slide.mobile_image ? [slide.image.url, slide.mobile_image.url] : [slide.image.url]
  )
