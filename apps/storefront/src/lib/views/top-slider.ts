import type { StoreLayout } from "@qticaret/types"
import { topSliderSettingsOf } from "@qticaret/types/section-top-slider"
import type { Translate, TopSliderView } from "@qticaret/ui"
import { layoutImage, layoutLink } from "./layout"

/**
 * The header group's top image slider (owner 2026-11-27) as the theme draws
 * it: each slide's pictures with their sizes and words, its link a path (a
 * broken one none), its steps read forgivingly. No slider, or no slides
 * yet: none, nothing drawn.
 */
export function topSliderView(header: StoreLayout["header"], t: Translate): TopSliderView | null {
  const section = header.find((each) => each.type === "top_slider")
  if (!section || section.slides.length === 0) {
    return null
  }
  return {
    id: section.id,
    slides: section.slides.map((slide) => ({
      image: layoutImage(slide.image, ""),
      mobileImage: slide.mobile_image
        ? layoutImage(slide.mobile_image, slide.image.alt ?? "")
        : null,
      link: layoutLink(slide.link, t),
    })),
    settings: topSliderSettingsOf(section),
  }
}
