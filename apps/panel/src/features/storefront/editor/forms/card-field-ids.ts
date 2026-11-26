import {
  CATEGORY_CARD_SETTINGS,
  CATEGORY_COLLAGE_SETTINGS,
  FOOTER_BAR_SETTINGS,
  FOOTER_COLUMNS_SETTINGS,
  PAYMENT_BADGES,
} from "@qticaret/types"
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

export const CARD_FIELDS = [
  "columns",
  "columns_mobile",
  "image_position",
  "links",
  "frame",
] as const
export type CardField = (typeof CARD_FIELDS)[number]

/** The collage's fields, in its form's order (adr/0049 Ek 2026-11-15); the panels' too (Ek 2026-11-19). */
export const COLLAGE_FIELDS = ["lead", "columns", "columns_mobile", "height", "links"] as const
export type CollageField = (typeof COLLAGE_FIELDS)[number]

export const FOOTER_FIELDS = [
  "social",
  "payment_badges",
  "back_to_top",
  "back_to_top_side",
  "back_to_top_shape",
  "back_to_top_mobile",
] as const
/** The brand columns footer's own (adr/0049 Ek 2026-11-17): words under "İçerik", the look under "Stil". */
export const FOOTER_COLUMNS_FIELDS = [
  "top_strip",
  "about",
  "ground",
  "badge_style",
  "news_place",
  "brand_contact",
  "bottom_align",
] as const
export type FooterColumnsField = (typeof FOOTER_COLUMNS_FIELDS)[number]
const FOOTER_COLUMNS_GROUPS = {
  top_strip: "content",
  about: "content",
  ground: "appearance",
  badge_style: "appearance",
  news_place: "appearance",
  brand_contact: "appearance",
  bottom_align: "appearance",
} as const satisfies Record<FooterColumnsField, string>

/** The free rows footer's own (adr/0070): the marks in the bottom line, its look as the brand columns'. */
export const FOOTER_ROWS_OWN = ["bottom_badges", "ground", "badge_style", "legal_place"] as const
export type FooterRowsOwnField = (typeof FOOTER_ROWS_OWN)[number]
const FOOTER_ROWS_OWN_GROUPS = {
  bottom_badges: "content",
  ground: "appearance",
  badge_style: "appearance",
  legal_place: "appearance",
} as const satisfies Record<FooterRowsOwnField, string>

export type FooterField = (typeof FOOTER_FIELDS)[number] | FooterColumnsField | FooterRowsOwnField

export const CARD_FIELD_IDS = {
  card: (sectionId: string, field: CardField | CollageField) => `${sectionId}-cards-${field}`,
  footer: (sectionId: string, field: FooterField) => `${sectionId}-footer-${field}`,
} as const

/** The steps a setting offers, as the search finds them by name ("Yanda", "Kare"). */
const stepsOf = (prefix: string, field: string): readonly string[] => {
  const lists: Readonly<Record<string, readonly (string | number)[]>> = {
    ...CATEGORY_CARD_SETTINGS,
    ...CATEGORY_COLLAGE_SETTINGS,
    ...FOOTER_BAR_SETTINGS,
    ...FOOTER_COLUMNS_SETTINGS,
    // The ways to pay, found by name ("Troy", "Kapıda ödeme")
    payment_badges: PAYMENT_BADGES,
  }
  return (lists[field] ?? []).map((step) => `${prefix}.${field}.${String(step)}`)
}

/**
 * The fields the section's form shows for these settings: the linked
 * cards' and the collage's in "Kartlar" (the frame with the look), and
 * the footer's (the button in its own group, its place, face and phones
 * only while it is on).
 */
export function cardFooterFields(section: AnySection): RegistryField[] {
  if (section.type === "categories" && section.variant === "linked") {
    return CARD_FIELDS.map((field) => ({
      key: `cards.${field}`,
      group: field === "frame" ? "frame" : "cards",
      label: `${CARDS}.${field}.label`,
      term: `${CARDS}.${field}.term`,
      options: stepsOf(CARDS, field),
      target: CARD_FIELD_IDS.card(section.id, field),
    }))
  }
  if (
    section.type === "categories" &&
    (section.variant === "collage" || section.variant === "panels")
  ) {
    // The panels' row count has no say while the lead stands beside the others (Ek 2026-11-19)
    const shown = COLLAGE_FIELDS.filter(
      (field) => !(section.variant === "panels" && section.lead === "on" && field === "columns")
    )
    return shown.map((field) => ({
      key: `cards.${field}`,
      group: "cards",
      label: `${CARDS}.${field}.label`,
      term: `${CARDS}.${field}.term`,
      options: stepsOf(CARDS, field),
      target: CARD_FIELD_IDS.card(section.id, field),
    }))
  }
  if (section.type === "footer_bar") {
    const common = FOOTER_FIELDS.filter(
      (field) => section.back_to_top || !field.startsWith("back_to_top_")
    ).map((field) => ({
      key: `footer.${field}`,
      group: field.startsWith("back_to_top") ? ("backToTop" as const) : ("content" as const),
      label: `${FOOTER}.${field}.label`,
      term: `${FOOTER}.${field}.term`,
      options: stepsOf(FOOTER, field),
      target: CARD_FIELD_IDS.footer(section.id, field),
    }))
    const groups: Readonly<Partial<Record<FooterField, "content" | "appearance">>> =
      section.variant === "brand_columns"
        ? FOOTER_COLUMNS_GROUPS
        : section.variant === "free_rows"
          ? FOOTER_ROWS_OWN_GROUPS
          : {}
    const own = (Object.keys(groups) as FooterField[]).map((field) => ({
      key: `footer.${field}`,
      group: groups[field] ?? ("content" as const),
      label: `${FOOTER}.${field}.label`,
      term: `${FOOTER}.${field}.term`,
      options: stepsOf(FOOTER, field),
      target: CARD_FIELD_IDS.footer(section.id, field),
    }))
    return [...common, ...own]
  }
  return []
}

/** How many of the linked cards' closed settings differ from their defaults (the closed group's count). */
export const cardsSetCount = (section: AnySection): number =>
  section.type === "categories" && section.variant === "linked" && section.frame !== "lined" ? 1 : 0
