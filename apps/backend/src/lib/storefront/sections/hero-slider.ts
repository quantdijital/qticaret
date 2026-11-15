import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, image, optional, shopText } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { SLIDER_SECONDS, sliderScroller, sliderSpeedOf } from "./scroller"
import type { SliderFields } from "./scroller"

/**
 * The home page's sliding opening (`hero_slider`, adr/0049 Ek 2026-11-06):
 * an extra to the still `hero`, never in its place. Two to six slides,
 * each the shop's picture (a phone's own crop optional), its heading, a
 * short line and one action, its words on the left, the right or the
 * middle, light on a dark picture or dark on a light one. It is driven by
 * the scroller kit's settings it has use for (bilesen-denetimi (b) 4):
 * still unless the shop turns that on; the theme stops it on hover,
 * focus, a visitor's own step and reduced motion.
 */

export const SLIDER_LIMITS = {
  slides: { min: 2, max: LAYOUT_LIMITS.slides },
  /** Seconds a slider saved before the kit could hold; read as the nearest speed step. */
  interval: { min: 5, max: 10 },
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

const heroSliderFields = z
  .object({
    ...bodyFields,
    type: z.literal("hero_slider"),
    slides: z.array(heroSlide).min(SLIDER_LIMITS.slides.min).max(SLIDER_LIMITS.slides.max),
    height: z.enum(["compact", "regular"]).default("regular"),
    /** The kit's settings; absent from a slider saved before the kit (its switches below). */
    scroller: sliderScroller.optional(),
    // A slider saved before the kit: read once into `scroller` (`fromLegacy`), never written again
    autoplay: z.boolean().optional(),
    interval: z
      .number()
      .int()
      .min(SLIDER_LIMITS.interval.min)
      .max(SLIDER_LIMITS.interval.max)
      .optional(),
    dots: z.boolean().optional(),
    arrows: z.boolean().optional(),
  })
  .strict()

type Stored = z.output<typeof heroSliderFields>

export const heroSlider = heroSliderFields.transform(fromLegacy)

/**
 * The slider with its kit settings in force. A slider saved before the
 * kit reads its switches into them (still unless `autoplay`, dots and
 * arrows unless off, seconds as the nearest speed), before any default
 * fills a step, so a save of an old slider keeps what it drew. Seconds no
 * step keeps (7, 9, 10) stay while they stand for the speed in force; a
 * step the shop picked drops them.
 */
function fromLegacy({
  autoplay,
  interval,
  dots,
  arrows,
  scroller,
  ...section
}: Stored): Omit<Stored, "autoplay" | "dots" | "arrows" | "scroller"> & { scroller: SliderFields } {
  const settings =
    scroller ??
    sliderScroller.parse({
      ...(autoplay === true ? { autoplay: "on" } : {}),
      ...(dots === false ? { dots: "off" } : {}),
      ...(arrows === false ? { arrows: "hidden" } : {}),
      ...(interval === undefined ? {} : { speed: sliderSpeedOf(interval) }),
    })
  const kept =
    interval !== undefined &&
    sliderSpeedOf(interval) === settings.speed &&
    SLIDER_SECONDS[settings.speed] !== interval
  return { ...section, scroller: settings, ...(kept ? { interval } : {}) }
}

export type HeroSlider = z.infer<typeof heroSlider>

/** Every picture a slider shows: each slide's, and a phone's own where it has one. */
export const sliderImages = (section: HeroSlider): string[] =>
  section.slides.flatMap((slide) =>
    slide.mobile_image ? [slide.image.url, slide.mobile_image.url] : [slide.image.url]
  )
