import type { AnySection, FooterNewsletter, LayoutGroup } from "@/features/storefront/api/layout"

/** The footer box's variants drawn as a band: the ones that may stand on the footer's ground. */
const BANDS: readonly string[] = ["split", "image_card", "strip"]

/** Whether the section is the footer group's newsletter box drawn as a band (adr/0070 §4 Ek). */
export const isFooterBand = (
  section: AnySection,
  group: LayoutGroup
): section is FooterNewsletter =>
  group === "footer" && section.type === "newsletter" && BANDS.includes(section.variant)

/** The box with its band on the footer's ground, or without the field (off: as it was). */
export function withJoined(section: FooterNewsletter, joined: boolean): FooterNewsletter {
  const next = { ...section }
  delete next.joined
  return joined ? { ...next, joined: true } : next
}
