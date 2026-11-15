import "server-only"
import type { StoreHeroSliderSection } from "@qticaret/types"
import { sliderSecondsOf, sliderSettingsOf } from "@qticaret/types/section-scroller"
import type { HeroSliderSectionView, Translate } from "@qticaret/ui"
import { layoutImage, layoutLink } from "./layout"

/**
 * The home page's sliding opening (adr/0049 Ek 2026-11-06) as a theme
 * draws it: each slide's pictures with their sizes (a phone's own when the
 * shop gave one), its words and its one action. A picture without words
 * of its own is named by the slide's heading, else the media library's.
 * Its kit settings read forgivingly, a backend's from before the kit too.
 */
export function heroSliderView(
  section: StoreHeroSliderSection,
  t: Translate
): HeroSliderSectionView {
  const settings = sliderSettingsOf(section)
  return {
    id: section.id,
    type: "hero_slider",
    slides: section.slides.map((slide) => ({
      image: layoutImage(slide.image, slide.heading ?? ""),
      mobileImage: slide.mobile_image
        ? layoutImage(slide.mobile_image, slide.image.alt ?? slide.heading ?? "")
        : null,
      heading: slide.heading,
      text: slide.text,
      link: layoutLink(slide.link, t),
      position: slide.position,
      tone: slide.tone,
    })),
    height: section.height,
    settings,
    interval: sliderSecondsOf(section, settings),
  }
}
