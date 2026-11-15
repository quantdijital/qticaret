import type { StoreLayout, StoreMarqueeSection, TrustIcon } from "@qticaret/types"
import { deviceOf } from "@qticaret/types/section-device"
import { marqueeSettingsOf } from "@qticaret/types/section-marquee"
import type { MarqueeSectionView, Translate } from "@qticaret/ui"
import { layoutLink } from "./layout"

// The icons this build draws: one a newer backend added is left out, not drawn as nothing
const ICONS: ReadonlySet<string> = new Set([
  "truck",
  "clock",
  "shield",
  "card",
  "refresh",
  "award",
  "gift",
  "phone",
] satisfies TrustIcon[])

/**
 * A scrolling strip as the theme draws it (adr/0049 Ek 2026-11-14 §4.1):
 * its items in the shop's words, their links as paths (a broken one none),
 * its steps as the contract knows them (an unknown one, from a newer
 * backend, or none, from an older one, read as the default); an icon this build does not draw is
 * left out. No items: no strip.
 */
export function marqueeView(section: StoreMarqueeSection, t: Translate): MarqueeSectionView | null {
  const items = section.items.map((item) => ({
    icon: item.icon && ICONS.has(item.icon) ? item.icon : null,
    text: item.text,
    subtext: item.subtext,
    link: layoutLink(item.link, t),
  }))
  return items.length > 0
    ? {
        id: section.id,
        type: "marquee",
        items,
        ...marqueeSettingsOf(section),
      }
    : null
}

/**
 * The header group's strip, drawn above the shop's header, with the screens
 * it shows on (none: everywhere; on a page that is every section's,
 * `sections.ts`); none: no strip.
 */
export function headerMarquee(header: StoreLayout["header"], t: Translate) {
  const section = header.find((each) => each.type === "marquee")
  const view = section ? marqueeView(section, t) : null
  const device = deviceOf(section?.device)
  return view && device !== "all" ? { ...view, device } : view
}
