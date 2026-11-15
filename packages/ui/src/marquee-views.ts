import type { MarqueeSettings, TrustIcon } from "@qticaret/types"
import type { SectionDeviceView } from "./content-views"
import type { LinkView } from "./views"

/**
 * The scrolling strip as a theme draws it (adr/0049 Ek 2026-11-14 §4.1):
 * on the home, product and category pages, and once above the header
 * (`ShopView.marquee`). Its items in the shop's words with their links
 * already paths (a broken one none), its steps the ones the contract knows
 * (an unknown one read as the default). A theme slides it with CSS only,
 * stops it on hover, on focus and with a visible pause button (WCAG
 * 2.2.2), keeps it still under `prefers-reduced-motion`, and writes each
 * item once for assistive tech (the loop's copy hidden and inert).
 */
export interface MarqueeSectionView extends MarqueeSettings {
  id: string
  type: "marquee"
  items: MarqueeItemView[]
  /** Which screens show it; none: everywhere. On a page it comes as every section's (`HomeSectionView`). */
  device?: SectionDeviceView
}

export interface MarqueeItemView {
  /** One of the trust badges' icons; null: none. */
  icon: TrustIcon | null
  text: string
  subtext: string | null
  link: LinkView | null
}
