import { TOP_SLIDER_DEFAULTS } from "@qticaret/types"
import type { HeaderSection, TopSliderSection } from "@/features/storefront/api/layout"
import { newAnnouncementBar, newHeaderMarquee } from "./sections"

/**
 * What the top strip's chooser adds (owner 2026-11-27), each a design of
 * its own: the dark text strip, the light strip, the image slider (its own
 * section type) and the scrolling strip.
 */
export type TopStripKind = "graphite" | "light" | "slider" | "marquee"

export const TOP_STRIP_KINDS: readonly TopStripKind[] = ["slider", "graphite", "light", "marquee"]

/** The section type each card adds: the header group holds one of each. */
export const TOP_STRIP_TYPE = {
  graphite: "announcement_bar",
  light: "announcement_bar",
  slider: "top_slider",
  marquee: "marquee",
} as const satisfies Record<TopStripKind, HeaderSection["type"]>

/** The image slider, no pictures yet: nothing is drawn until it has one. */
export const newTopSlider = (id: string): TopSliderSection => ({
  id,
  type: "top_slider",
  visible: true,
  starts_at: null,
  ends_at: null,
  slides: [],
  ...TOP_SLIDER_DEFAULTS,
})

/** A new top strip section of the kind, as its card shows it. */
export function newTopStrip(kind: TopStripKind, id: string): HeaderSection {
  switch (kind) {
    case "marquee":
      return newHeaderMarquee(id)
    case "slider":
      return newTopSlider(id)
    case "light":
      return { ...newAnnouncementBar(id), variant: "light" }
    case "graphite":
      return newAnnouncementBar(id)
  }
}
