import type { HeroCatalogSlide } from "@/features/storefront/api/layout"
import type { CatalogHero } from "./slider-kit"

/**
 * The shop's name as a slide's heading: an opening saved before slides
 * drew its name where it had no heading, a slide draws none (adr/0049 Ek
 * 2026-11-15), so the first edit keeps the name as the token it fills.
 */
export const SHOP_NAME_TOKEN = "{mağaza_adı}"

/**
 * H17's slides as the editor shows them: the saved ones, else the
 * opening's own words, buttons and picture as its one slide.
 */
export const slidesOf = (section: CatalogHero): HeroCatalogSlide[] =>
  section.slides ?? [
    {
      image: section.image,
      heading: section.heading ?? SHOP_NAME_TOKEN,
      text: section.text,
      links: section.links,
      link: null,
    },
  ]

/**
 * The opening with these slides, its common heading, line, buttons and
 * picture the first's (so today's variant, switched to, shows it).
 */
export function withSlides(section: CatalogHero, slides: HeroCatalogSlide[]): CatalogHero {
  const [first] = slides
  if (!first) {
    return section
  }
  return {
    ...section,
    slides,
    heading: first.heading,
    text: first.text,
    links: first.links,
    image: first.image,
  }
}

/** A new slide from a library picture: the picture alone until the shop gives it words. */
export const pictureSlide = (image: { url: string; alt: string | null }): HeroCatalogSlide => ({
  image: { url: image.url, alt: image.alt },
  heading: null,
  text: null,
  links: [],
  link: null,
})

/** Whether the slide is its picture alone on the storefront: no heading, line or button. */
export const isPictureOnly = (slide: HeroCatalogSlide): boolean =>
  slide.heading === null && slide.text === null && slide.links.length === 0

/** Whether the slide shows nothing: no picture and no words (the server refuses it). */
export const isEmptySlide = (slide: HeroCatalogSlide): boolean =>
  slide.image === null && isPictureOnly(slide)
