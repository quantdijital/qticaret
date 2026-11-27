import type { NewsletterConsentStyle, NewsletterTone } from "@qticaret/types"
import type {
  AnySection,
  FooterNewsletter,
  LayoutGroup,
  NewsletterSection,
} from "@/features/storefront/api/layout"

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

/** Whether the section is a newsletter box drawn as a band, on a page or in the footer: it takes a ground tone. */
export const isNewsletterBand = (
  section: AnySection
): section is NewsletterSection | FooterNewsletter =>
  section.type === "newsletter" && BANDS.includes(section.variant)

/** The box with its ground tone, or without the field (`plain`: as it was). */
export function withTone<T extends NewsletterSection | FooterNewsletter>(
  section: T,
  tone: NewsletterTone
): T {
  const next = { ...section }
  delete next.tone
  return tone === "tint" ? { ...next, tone } : next
}

/** The box with how it asks for the consent, or without the field (`box`: as it was). */
export function withConsentStyle<T extends { consent_style?: NewsletterConsentStyle }>(
  section: T,
  style: NewsletterConsentStyle
): T {
  const next = { ...section }
  delete next.consent_style
  return style === "line" ? { ...next, consent_style: style } : next
}
