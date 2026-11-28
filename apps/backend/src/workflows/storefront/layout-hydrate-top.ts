import type { TopSlider } from "../../lib/storefront/sections/top-slider"
import type { HydrateContext, StoreLayoutImage } from "./layout-hydrate"

/**
 * The top image slider as the storefront prints it (owner 2026-11-27): its
 * slides' pictures with their sizes, their links placed (a broken one
 * null, the slide kept), its steps as saved.
 */
export function hydrateTopSlider(section: TopSlider, at: HydrateContext) {
  const image = (url: string, alt: string | null): StoreLayoutImage => ({
    ...(at.images.get(url) ?? { url, alt, width: null, height: null, derivatives: null }),
    alt,
  })
  return {
    id: section.id,
    type: section.type,
    slides: section.slides.map((slide) => ({
      image: image(slide.image.url, slide.image.alt),
      mobile_image: slide.mobile_image
        ? image(slide.mobile_image.url, slide.mobile_image.alt ?? slide.image.alt)
        : null,
      link: slide.link ? (at.links.get(slide.link) ?? null) : null,
    })),
    height: section.height,
    interval: section.interval,
    transition: section.transition,
    arrows: section.arrows,
    dots: section.dots,
  }
}
