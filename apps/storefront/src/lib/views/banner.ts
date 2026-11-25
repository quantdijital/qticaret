import "server-only"
import type { StoreBannerSection } from "@qticaret/types"
import {
  bannerSplitEdgeOf,
  bannerSplitOrnamentOf,
  bannerSplitToneOf,
  bannerStepOf,
  bannerToneOf,
} from "@qticaret/types/section-banner"
import { variantOf } from "@qticaret/types/section-variants"
import type { BannerSectionView, Translate } from "@qticaret/ui"
import { handNoteView } from "./accent"
import { layoutImage, layoutLink } from "./layout"

/**
 * The picture band (adr/0049 Ek 2026-11-14 §3.3 E2) as a theme draws it:
 * each slide's pictures with their sizes (a phone's own when the shop gave
 * one), its words and its one or two buttons as paths (a broken one none,
 * and a second without a first moves up); the band's steps and a slide's
 * tone as the contract knows them (an unknown one, or none from a backend
 * before them, read as the default).
 */
export function bannerView(
  section: StoreBannerSection,
  t: Translate,
  /** The split's hand note in the shop's accent face (`noteInHand`); absent: not. */
  hand = false
): BannerSectionView {
  const note = handNoteView(section.note, hand)
  return {
    id: section.id,
    type: "banner",
    slides: section.slides.map((slide) => {
      const first = layoutLink(slide.link, t)
      const [link = null, secondLink = null] = [
        first,
        layoutLink(slide.second_link ?? null, t),
      ].filter((each) => each !== null)
      return {
        // The second moved up: the editor's field mark names it (adr/0065 Faz 2b)
        ...(first === null && link !== null ? { secondFirst: true as const } : {}),
        image: layoutImage(slide.image, slide.heading ?? ""),
        mobileImage: slide.mobile_image
          ? layoutImage(slide.mobile_image, slide.image.alt ?? slide.heading ?? "")
          : null,
        heading: slide.heading,
        text: slide.text,
        link,
        secondLink,
        tone: bannerToneOf(slide.tone),
      }
    }),
    width: bannerStepOf("width", section.width),
    height: bannerStepOf("height", section.height),
    text_position: bannerStepOf("text_position", section.text_position),
    overlay: bannerStepOf("overlay", section.overlay),
    button_style: bannerStepOf("button_style", section.button_style),
    // The split (adr/0077 Ek) only when the contract knows it; else today's slides
    ...(variantOf("banner", section.variant) === "split"
      ? {
          variant: "split" as const,
          eyebrow: section.eyebrow ?? null,
          edge: bannerSplitEdgeOf(section.edge),
          // The hand note only when there is one: a split without it is the view it was
          ...(note ? { note } : {}),
          ...(bannerSplitToneOf(section.button_tone) === "accent"
            ? { buttonTone: "accent" as const }
            : {}),
          ...(bannerSplitOrnamentOf(section.ornament) === "flower"
            ? { ornament: "flower" as const }
            : {}),
        }
      : {}),
  }
}
