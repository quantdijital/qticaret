import { CATEGORY_CARD_SETTINGS, FOOTER_BAR_SETTINGS, PAYMENT_BADGES } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { RegistryField } from "./field-registry"

/**
 * The linked category cards' and the footer bar's settings in the
 * settings search (adr/0049 Ek 2026-11-15): their element ids, shared by
 * the forms and the search, and their register entries, built from the
 * contract's lists as the forms are.
 */

const CARDS = "storefront.editor.categoryCards"
const FOOTER = "storefront.editor.footerBar"

export const CARD_FIELDS = ["columns", "image_position", "links", "frame"] as const
export type CardField = (typeof CARD_FIELDS)[number]

export const FOOTER_FIELDS = [
  "social",
  "payment_badges",
  "back_to_top",
  "back_to_top_side",
  "back_to_top_shape",
  "back_to_top_mobile",
] as const
export type FooterField = (typeof FOOTER_FIELDS)[number]

export const CARD_FIELD_IDS = {
  card: (sectionId: string, field: CardField) => `${sectionId}-cards-${field}`,
  footer: (sectionId: string, field: FooterField) => `${sectionId}-footer-${field}`,
} as const

/** The steps a setting offers, as the search finds them by name ("Yanda", "Kare"). */
const stepsOf = (prefix: string, field: string): readonly string[] => {
  const lists: Readonly<Record<string, readonly (string | number)[]>> = {
    ...CATEGORY_CARD_SETTINGS,
    ...FOOTER_BAR_SETTINGS,
    // The ways to pay, found by name ("Troy", "Kapıda ödeme")
    payment_badges: PAYMENT_BADGES,
  }
  return (lists[field] ?? []).map((step) => `${prefix}.${field}.${String(step)}`)
}

/**
 * The fields the section's form shows for these settings: the linked
 * cards' (the frame with the look, closed), and the footer's (the
 * button's place, face and phones only while the button is on).
 */
export function cardFooterFields(section: AnySection): RegistryField[] {
  if (section.type === "categories" && section.variant === "linked") {
    return CARD_FIELDS.map((field) => ({
      key: `cards.${field}`,
      group: field === "frame" ? "look" : "content",
      label: `${CARDS}.${field}.label`,
      term: `${CARDS}.${field}.term`,
      options: stepsOf(CARDS, field),
      target: CARD_FIELD_IDS.card(section.id, field),
    }))
  }
  if (section.type === "footer_bar") {
    return FOOTER_FIELDS.filter(
      (field) => section.back_to_top || !field.startsWith("back_to_top_")
    ).map((field) => ({
      key: `footer.${field}`,
      group: "content",
      label: `${FOOTER}.${field}.label`,
      term: `${FOOTER}.${field}.term`,
      options: stepsOf(FOOTER, field),
      target: CARD_FIELD_IDS.footer(section.id, field),
    }))
  }
  return []
}

/** How many of the linked cards' closed settings differ from their defaults (the closed group's count). */
export const cardsSetCount = (section: AnySection): number =>
  section.type === "categories" && section.variant === "linked" && section.frame !== "lined" ? 1 : 0
