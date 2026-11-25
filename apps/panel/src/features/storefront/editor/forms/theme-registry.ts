import {
  ACCENT_FONTS,
  BACKGROUNDS,
  BODY_FONTS,
  BUTTON_SHAPES,
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_RATIOS,
  CARD_SOLD_OUT_ROWS,
  CARD_VARIANTS,
  HEADING_FONTS,
  LISTING_TEXT_ALIGNS,
  LISTING_TEXT_SIZES,
  LISTING_TEXT_WIDTHS,
  RADII,
  SECTION_SPACINGS,
  STYLE_KIT,
  SURFACE_STYLES,
} from "@/features/storefront/api/theme"
import type {
  CARD_BADGE_SWITCHES,
  FRAMED_CARD_SWITCHES,
  QUICK_VIEW_SWITCHES,
  ThemeChoices,
} from "@/features/storefront/api/theme"
import type { CardVariant, StyleKitField } from "@qticaret/types"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { allSections } from "@/features/storefront/layout/sections"
import { STYLE_KIT_READY } from "./style-kit-ready"
import { LISTING_PAGE_META } from "./theme-registry-listing-page"
import { SEARCH_FORM_META } from "./theme-registry-search"
import { TOUR_CARD_META } from "./theme-registry-tour"

/**
 * The theme panel's fields as the settings search knows them (adr/0049 Ek
 * 2026-11-15): built from the theme's own shape (`ThemeChoices`), each of
 * its fields named once below, so a field the theme gains and the panel
 * leaves out fails to compile instead of hiding from the search. The form
 * takes its elements' ids from here (`THEME_IDS`), so a hit lands on the
 * field it names.
 */

const C = "storefront.editor.theme"

/** The theme panel's groups, in its order. */
export type ThemeGroupName =
  | "colors"
  | "fonts"
  | "shapes"
  | "spacing"
  | "surfaces"
  | "card"
  | "framed"
  | "listingText"
  | "listingPage"
  | "searchForm"

/** Each group's title (i18n key), as the panel and a hit's second line show it. */
export const THEME_GROUP_TITLES: Readonly<Record<ThemeGroupName, string>> = {
  colors: `${C}.colors`,
  fonts: `${C}.fontsTitle`,
  shapes: `${C}.shapes`,
  spacing: `${C}.spacing`,
  surfaces: `${C}.surfaces`,
  card: `${C}.card`,
  framed: `${C}.framed`,
  listingText: `${C}.listingTextTitle`,
  listingPage: `${C}.listingPageTitle`,
  searchForm: `${C}.searchFormTitle`,
}

/** Every field of the theme's choices by its path: `colors.primary`, `product_card.variant`, `radius`. */
export type ThemeField = {
  [G in keyof ThemeChoices]: ThemeChoices[G] extends object
    ? `${G}.${keyof ThemeChoices[G] & string}`
    : G
}[keyof ThemeChoices]

/** Where the cards are drawn framed or compact: the theme's variant and every rail's own. */
export type CardVariantsInUse = ReadonlySet<CardVariant>

/** The shop's flags that are on (`catalog.booking`), for a field only such a shop needs. */
export type ShopFlags = ReadonlySet<string>

/** No flag on: what a field asks of the shop's flags while they load or outside the editor. */
export const NO_SHOP_FLAGS: ShopFlags = new Set()

export interface FieldMeta {
  group: ThemeGroupName
  label: string
  term?: string
  /** The choices' names (i18n keys): "Hap" finds the buttons. */
  options?: readonly string[]
  /** More words the search finds it by, never shown (an i18n key): "boşluk" finds the spacing. */
  keywords?: string
  /** Whether the field means anything now; hidden from the form and the search otherwise. */
  shown?: (theme: ThemeChoices, variants: CardVariantsInUse, flags: ShopFlags) => boolean
}

const named = (list: readonly string[], prefix: string, key = (option: string) => option) =>
  list.map((option) => `${C}.${prefix}.${key(option)}`)

const fonts = (list: readonly string[]) => named(list, "fonts")

const framedSwitch = (name: (typeof FRAMED_CARD_SWITCHES)[number]): FieldMeta => ({
  group: "framed",
  label: `${C}.${name}`,
})

/** A pill's switch (adr/0049 Ek 2026-11-15, decision a): "badge" finds them all. */
const badge = (name: (typeof CARD_BADGE_SWITCHES)[number]): FieldMeta => ({
  group: "card",
  label: `${C}.${name}`,
  term: `${C}.badgeTerm`,
})

/** Whether the shop has the quick view on: its other fields mean nothing while it is off. */
const quickViewOn = (theme: ThemeChoices) => theme.product_card.quick_view

/** What the quick view dialog shows (adr/0049 Ek 2026-11-15): "quick view" finds them all. */
const quickViewSwitch = (name: (typeof QUICK_VIEW_SWITCHES)[number]): FieldMeta => ({
  group: "card",
  label: `${C}.${name}`,
  term: `${C}.quick_viewTerm`,
  shown: quickViewOn,
})

/**
 * A style kit field (adr/0067 §1): `styleKit.<field>.*` names; out of the
 * panel and its search until the storefront draws it (`STYLE_KIT_READY`).
 */
const kitField = (field: StyleKitField, group: ThemeGroupName): FieldMeta => ({
  group,
  label: `${C}.styleKit.${field}.label`,
  term: `${C}.styleKit.${field}.term`,
  options: named(STYLE_KIT[field], `styleKit.${field}.steps`),
  shown: () => STYLE_KIT_READY[field],
})

/**
 * The listing pages' text (adr/0075 §6): "açıklama", "devamını oku" find
 * every one of its fields.
 */
const listingText = (
  field: "size" | "align" | "width" | "collapse",
  steps: readonly string[] = []
): FieldMeta => ({
  group: "listingText",
  label: `${C}.listingText.${field}.label`,
  options: named(steps, `listingText.${field}.steps`),
  keywords: `${C}.listingText.words`,
})

/**
 * Each field's place, name and choices; null: not in the theme panel (the
 * header's layout and stickiness are the header bar's, adr/0049 Ek
 * 2026-11-14 §5).
 */
const META: Readonly<Record<ThemeField, FieldMeta | null>> = {
  "colors.primary": { group: "colors", label: `${C}.primary` },
  "colors.accent": { group: "colors", label: `${C}.accent` },
  "colors.background": {
    group: "colors",
    label: `${C}.background`,
    options: named(BACKGROUNDS, "backgrounds"),
  },
  "typography.heading": {
    group: "fonts",
    label: `${C}.heading`,
    term: `${C}.fontTerm`,
    options: fonts(HEADING_FONTS),
  },
  "typography.body": {
    group: "fonts",
    label: `${C}.body`,
    term: `${C}.fontTerm`,
    options: fonts(BODY_FONTS),
  },
  // The hand note's face (sahip 2026-11-24): "el yazısı" finds it
  "typography.accent": {
    group: "fonts",
    label: `${C}.accentFont`,
    term: `${C}.accentFontTerm`,
    options: named(ACCENT_FONTS, "accentFonts"),
    keywords: `${C}.handwriting`,
  },
  radius: {
    group: "shapes",
    label: `${C}.radius`,
    term: `${C}.radiusTerm`,
    options: named(RADII, "radii"),
  },
  buttons: {
    group: "shapes",
    label: `${C}.buttons`,
    options: named(BUTTON_SHAPES, "buttonShapes"),
  },
  // adr/0067 §2.7: shapes are corners, buttons and chips; surfaces the rest
  chip_style: kitField("chip_style", "shapes"),
  // The room on the page in its own group, by name (owner 2026-11-16: the section spacing
  // was not found among the surfaces); the corners stay shapes
  section_spacing: {
    group: "spacing",
    label: `${C}.sectionSpacing`,
    term: `${C}.sectionSpacingTerm`,
    options: named(SECTION_SPACINGS, "sectionSpacings"),
    keywords: `${C}.spacingWords`,
  },
  density: { ...kitField("density", "spacing"), keywords: `${C}.spacingWords` },
  surface_style: {
    group: "surfaces",
    label: `${C}.surfaceStyle`,
    term: `${C}.surfaceStyleTerm`,
    options: named(SURFACE_STYLES, "surfaceStyles"),
  },
  shadow: kitField("shadow", "surfaces"),
  media_ground: kitField("media_ground", "surfaces"),
  menu_style: kitField("menu_style", "surfaces"),
  motion: kitField("motion", "surfaces"),
  "product_card.ratio": {
    group: "card",
    label: `${C}.ratio`,
    term: `${C}.ratioTerm`,
    options: named(CARD_RATIOS, "ratios", (option) => option.replace(":", "x")),
  },
  "product_card.variant": {
    group: "card",
    label: `${C}.cardVariant`,
    options: named(CARD_VARIANTS, "cardVariants"),
  },
  "product_card.show_brand": { group: "card", label: `${C}.show_brand` },
  "product_card.show_rating": { group: "card", label: `${C}.show_rating` },
  // The owner's card decisions (adr/0049 Ek 2026-11-15), each hidden where it means nothing
  "product_card.no_reviews": {
    group: "card",
    label: `${C}.no_reviews`,
    term: `${C}.no_reviewsTerm`,
    options: named(CARD_NO_REVIEWS, "noReviews"),
    shown: (theme) => theme.product_card.show_rating,
  },
  "product_card.sale_badge": badge("sale_badge"),
  "product_card.low_stock_badge": {
    ...badge("low_stock_badge"),
    // The compact card draws no "Az kaldı"
    shown: (_theme, variants) => [...variants].some((variant) => variant !== "compact"),
  },
  "product_card.sold_out_badge": badge("sold_out_badge"),
  "product_card.sold_out_row": {
    group: "card",
    label: `${C}.sold_out_row`,
    term: `${C}.sold_out_rowTerm`,
    options: named(CARD_SOLD_OUT_ROWS, "soldOutRows"),
  },
  // The quick view (adr/0049 Ek 2026-11-15): its look and contents only while it is on
  "product_card.quick_view": {
    group: "card",
    label: `${C}.quick_view`,
    term: `${C}.quick_viewTerm`,
  },
  "product_card.quick_view_trigger": {
    group: "card",
    label: `${C}.quick_view_trigger`,
    term: `${C}.quick_view_triggerTerm`,
    options: named(CARD_QUICK_VIEW_TRIGGERS, "quickViewTriggers"),
    shown: quickViewOn,
  },
  "product_card.quick_view_rating": quickViewSwitch("quick_view_rating"),
  "product_card.quick_view_summary": quickViewSwitch("quick_view_summary"),
  "product_card.quick_view_quantity": quickViewSwitch("quick_view_quantity"),
  // Every card's since sahip 2026-11-18 (the framed card's before)
  "product_card.hover_image": { group: "card", label: `${C}.hover_image` },
  "product_card.delivery_note": framedSwitch("delivery_note"),
  "product_card.full_button": framedSwitch("full_button"),
  // The tour card's look (adr/0077 Ek "tur kartı"), each hidden where it means nothing
  ...TOUR_CARD_META,
  "product_card.button_style": {
    group: "framed",
    label: `${C}.button_style`,
    term: `${C}.button_styleTerm`,
    options: named(CARD_BUTTON_STYLES, "buttonStyles"),
    // Only the button across the foot has a look; the round "+" has none
    shown: (theme) => theme.product_card.full_button,
  },
  "listing_text.size": listingText("size", LISTING_TEXT_SIZES),
  "listing_text.align": listingText("align", LISTING_TEXT_ALIGNS),
  "listing_text.width": listingText("width", LISTING_TEXT_WIDTHS),
  "listing_text.collapse": listingText("collapse"),
  // A listing page's grid or list, its switch and its trail
  ...LISTING_PAGE_META,
  // The search box's fields (adr/0077 §1)
  ...SEARCH_FORM_META,
  "header.layout": null,
  "header.sticky": null,
}

export interface ThemeRegistryField {
  key: ThemeField
  group: ThemeGroupName
  label: string
  term: string | null
  options: readonly string[]
  /** Search-only words (an i18n key); null: none. */
  keywords: string | null
  /** The element the search scrolls to, focuses and marks. */
  target: string
  shown: (theme: ThemeChoices, variants: CardVariantsInUse, flags: ShopFlags) => boolean
}

/** A field's element id in the theme panel: `theme-product-card-variant`. */
const idOf = (key: string) => `theme-${key.replace(/[._]/g, "-")}`

const always = () => true

/** The theme panel's fields, in the panel's order. */
export const THEME_FIELDS: readonly ThemeRegistryField[] = (
  Object.entries(META) as [ThemeField, FieldMeta | null][]
).flatMap(([key, meta]) =>
  meta
    ? [
        {
          key,
          group: meta.group,
          label: meta.label,
          term: meta.term ?? null,
          options: meta.options ?? [],
          keywords: meta.keywords ?? null,
          target: idOf(key),
          shown: meta.shown ?? always,
        },
      ]
    : []
)

/** The fields the theme panel draws: the header bar draws the header's two. */
export type PanelField = Exclude<ThemeField, "header.layout" | "header.sticky">

/** Each field's element id, for the form. */
export const THEME_IDS = Object.fromEntries(
  THEME_FIELDS.map((field) => [field.key, field.target])
) as Readonly<Record<PanelField, string>>

/** Each field by its path, for the form's labels, hints and visibility. */
export const THEME_FIELD = Object.fromEntries(
  THEME_FIELDS.map((field) => [field.key, field])
) as Readonly<Record<PanelField, ThemeRegistryField>>

/** The card variants the draft draws: the theme's, and every product rail's own. */
export function cardVariantsInUse(doc: LayoutDocument): CardVariantsInUse {
  // A content page's rails too (adr/0073)
  const rails = allSections(doc).flatMap((section) =>
    "card_variant" in section && section.card_variant ? [section.card_variant] : []
  )
  return new Set([doc.settings.theme.product_card.variant, ...rails])
}
