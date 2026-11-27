import type { AnnouncementBar } from "@/features/storefront/api/layout"
import { newAnnouncementBar, newHeaderMarquee } from "./sections"

/** What the top strip's chooser adds: the strip in one of its looks, or the scrolling strip. */
export type TopStripKind = "graphite" | "light" | "slider" | "marquee"

export const TOP_STRIP_KINDS: readonly TopStripKind[] = ["graphite", "light", "slider", "marquee"]

/**
 * A new top strip section of the kind, its settings filled as the card shows:
 * the slider turns its lines one at a time, sliding, with arrows, and starts
 * with a few lines in the shop's voice to change (owner 2026-11-27).
 */
export function newTopStrip(
  kind: TopStripKind,
  id: string,
  sliderLines: readonly string[]
): AnnouncementBar | ReturnType<typeof newHeaderMarquee> {
  if (kind === "marquee") {
    return newHeaderMarquee(id)
  }
  const bar = newAnnouncementBar(id)
  if (kind === "light") {
    return { ...bar, variant: "light" }
  }
  if (kind === "slider") {
    return {
      ...bar,
      lines: [...sliderLines],
      mode: "rotate",
      transition: "slide",
      arrows: "on",
    }
  }
  return bar
}
