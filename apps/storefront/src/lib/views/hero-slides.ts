import "server-only"
import type { StoreHeroCatalog } from "@qticaret/types"
import {
  HERO_CATALOG_SLIDER_DEFAULTS,
  sliderSecondsOf,
  sliderSettingsOf,
} from "@qticaret/types/section-scroller"
import type { HeroCatalogSlideView, HeroCatalogView, Translate } from "@qticaret/ui"
import { layoutImage, layoutLink, layoutLinks } from "./layout"

/**
 * H17's slides as the theme draws them (adr/0049 Ek 2026-11-15): each
 * slide's words, its buttons (a broken one left out), its picture named by
 * the shop's words for it, else the slide's heading, and where it leads. A
 * slide left with nothing to show (its only button broken) is dropped.
 * Two or more turn on the slider's settings, read forgivingly. An opening
 * saved before slides has none here: the theme draws its own fields as one.
 */
export function heroCatalogSlides(
  section: StoreHeroCatalog,
  t: Translate
): Pick<HeroCatalogView, "slides" | "slider"> {
  const kept = (section.slides ?? []).flatMap((slide, at) => {
    const { actions, actionsAt } = layoutLinks(slide.links, t)
    const image = slide.image ? layoutImage(slide.image, slide.heading ?? "") : null
    const shows = image !== null || slide.heading !== null || slide.text !== null
    return shows || actions.length > 0
      ? [
          {
            at,
            view: {
              heading: slide.heading,
              intro: slide.text,
              actions,
              ...(actionsAt ? { actionsAt } : {}),
              image,
              link: layoutLink(slide.link, t),
            },
          },
        ]
      : []
  })
  // A slide after one left out says its place in the design (the editor's field mark)
  const slides = kept.map(({ at, view }, drawn): HeroCatalogSlideView =>
    at === drawn ? view : { ...view, at }
  )
  if (slides.length === 0) {
    return {}
  }
  if (slides.length === 1) {
    return { slides }
  }
  const settings = sliderSettingsOf(section, HERO_CATALOG_SLIDER_DEFAULTS)
  return { slides, slider: { settings, interval: sliderSecondsOf(section, settings) } }
}
