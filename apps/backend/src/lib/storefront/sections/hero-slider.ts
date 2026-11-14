import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, image, optional, shopText } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"

/**
 * The home page's sliding opening (`hero_slider`, adr/0049 Ek 2026-11-06):
 * an extra to the still `hero`, never in its place. Two to six slides,
 * each the shop's picture (a phone's own crop optional), its heading, a
 * short line and one action, its words on the left, the right or the
 * middle, light on a dark picture or dark on a light one. It does not
 * move by itself unless the shop turns that on (5–10 s a slide); the
 * theme stops it on hover, focus, a visitor's own step and reduced motion.
 */

export const SLIDER_LIMITS = {
  slides: { min: 2, max: LAYOUT_LIMITS.slides },
  interval: { min: 5, max: 10, default: 6 },
} as const

export const heroSlide = z
  .object({
    image,
    /** A phone's own picture (a closer crop); none: the wide one. */
    mobile_image: optional(image),
    heading: optional(shopText(90)),
    text: optional(shopText(160)),
    /** The slide's one action. */
    link: optional(storefrontLink),
    position: z.enum(["left", "center", "right"]).default("left"),
    /** `light`: light words on a dark picture; `dark`: dark words on a light one. */
    tone: z.enum(["light", "dark"]).default("light"),
  })
  .strict()

export const heroSlider = z
  .object({
    ...bodyFields,
    type: z.literal("hero_slider"),
    slides: z.array(heroSlide).min(SLIDER_LIMITS.slides.min).max(SLIDER_LIMITS.slides.max),
    height: z.enum(["compact", "regular"]).default("regular"),
    /** Off unless the shop turns it on (WCAG 2.2.2: nothing moves by itself by default). */
    autoplay: z.boolean().default(false),
    /** Seconds a slide stays while it plays. */
    interval: z
      .number()
      .int()
      .min(SLIDER_LIMITS.interval.min)
      .max(SLIDER_LIMITS.interval.max)
      .default(SLIDER_LIMITS.interval.default),
    dots: z.boolean().default(true),
    arrows: z.boolean().default(true),
  })
  .strict()

export type HeroSlider = z.infer<typeof heroSlider>

/** Every picture a slider shows: each slide's, and a phone's own where it has one. */
export const sliderImages = (section: HeroSlider): string[] =>
  section.slides.flatMap((slide) =>
    slide.mobile_image ? [slide.image.url, slide.mobile_image.url] : [slide.image.url]
  )
