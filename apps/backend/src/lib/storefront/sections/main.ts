import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import { base, optional, text } from "../layout-fields"
import { storefrontLink } from "../menus"
import { footerBarFields } from "./footer-bar"
import { sectionLook } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The main sections (adr/0049 Ek 2026-11-14 §5, §7; Shopify's "main"):
 * the shop's header bar, its footer, the product's own block and the
 * category's product grid. One to a group, never removed, copied or
 * hidden; a design stored without one reads it with its default
 * (`withMainSections`), so nothing is migrated. Each starts with one
 * variant, the drawing from before them; the header bar's second is the
 * theme setting's centred header. Every main section but the header's and
 * the footer's frame takes a look (the theme draws those as it did).
 */

const MAIN_ERROR = { error: "storefront_layout.section_invalid" }

/** Always shown: a main section cannot be hidden or scheduled away (a forged editor is refused). */
const mainBase = {
  id: base.id,
  visible: z.custom<true>((value) => value === true, MAIN_ERROR).default(true),
  starts_at: z.custom<null>((value) => value === null, MAIN_ERROR).default(null),
  ends_at: z.custom<null>((value) => value === null, MAIN_ERROR).default(null),
}

export const MAIN_SECTION_TYPES = [
  "header_bar",
  "footer_bar",
  "product_main",
  "category_main",
] as const

export type MainSectionType = (typeof MAIN_SECTION_TYPES)[number]

export const isMainType = (type: unknown): type is MainSectionType =>
  (MAIN_SECTION_TYPES as readonly unknown[]).includes(type)

/** The ids a main section read in gets: fixed, so a draft and what is live read alike. */
export const MAIN_SECTION_IDS: Readonly<Record<MainSectionType, string>> = {
  header_bar: "mainheader",
  footer_bar: "mainfooter",
  product_main: "mainproduct",
  category_main: "maincategory",
}

/**
 * The menus' pictures' steps (adr/0049 Ek 2026-11-15): mirrors
 * `@qticaret/types`' `HEADER_MENU_IMAGES`; a unit test keeps them equal.
 */
export const HEADER_MENU_IMAGES = ["all", "submenus", "off"] as const

type MenuImages = (typeof HEADER_MENU_IMAGES)[number]

/**
 * How the header's search stands (adr/0049 Ek 2026-11-15): mirrors
 * `@qticaret/types`' `HEADER_SEARCH_STYLES` (a unit test keeps them
 * equal); `field`, the box drawn open as before, is the default.
 */
export const HEADER_SEARCH_STYLES = ["field", "icon"] as const

type SearchStyle = (typeof HEADER_SEARCH_STYLES)[number]

/**
 * The catalog header's layout choices (adr/0049 Ek 2026-11-15): mirror
 * `@qticaret/types`' `HEADER_TOOLS_PLACES`, `HEADER_TOP_LINKS_PLACES` and
 * `HEADER_SEARCH_WIDTHS` (a unit test keeps them equal); each list's first
 * is the drawing from before it.
 */
export const HEADER_TOOLS_PLACES = ["bar", "row"] as const
export const HEADER_TOP_LINKS_PLACES = ["strip", "bar"] as const
export const HEADER_SEARCH_WIDTHS = ["wide", "narrow"] as const

/** A header bar's named steps, each with its list: a stored bar keeps one only while listed. */
const HEADER_STEPS: Readonly<Record<string, readonly unknown[]>> = {
  menu_images: HEADER_MENU_IMAGES,
  search_style: HEADER_SEARCH_STYLES,
  tools_place: HEADER_TOOLS_PLACES,
  top_links: HEADER_TOP_LINKS_PLACES,
  search_width: HEADER_SEARCH_WIDTHS,
}

/**
 * A stored header bar's named steps as today's lists read them (forgiving
 * on reading, as `storedLook`): a step off its list (a development draft's
 * `true`/`false` from before the menus' pictures had steps, or a newer
 * build's) is dropped, so the bar reads with that field's default. A save
 * is still held to the lists.
 */
export function storedMenuImages(section: Record<string, unknown>): Record<string, unknown> {
  if (section["type"] !== "header_bar") {
    return section
  }
  const off = (key: string) => {
    const steps = HEADER_STEPS[key]
    return steps !== undefined && !steps.includes(section[key])
  }
  return Object.keys(section).some(off)
    ? Object.fromEntries(Object.entries(section).filter(([key]) => !off(key)))
    : section
}

const headerCommon = {
  ...mainBase,
  type: z.literal("header_bar"),
  /** The header stays at the top of a long page (the theme setting's `header.sticky` before). */
  sticky: z.boolean().default(true),
  /**
   * Where the menus show the categories' pictures (adr/0049 Ek 2026-11-15),
   * whatever the variant: `all` (the "Kategoriler" list too), `submenus`
   * (the dropdowns and the phone's sheet, as drawn before it: the default,
   * so a bar saved without it reads as it was drawn), `off`. A step off
   * the list is a stale or forged editor; on reading a stored design it is
   * dropped (`storedMenuImages`).
   */
  menu_images: z
    .custom<MenuImages>(
      (value) => (HEADER_MENU_IMAGES as readonly unknown[]).includes(value),
      MAIN_ERROR
    )
    .default("submenus"),
  /**
   * How the search stands, whatever the variant: `field` (the box drawn
   * open, as before it: the default) or `icon` (a magnifier that opens it;
   * on a phone the bottom bar's "Ara" drops it down). A step off the list
   * is a stale or forged editor; on reading a stored design it is dropped.
   */
  search_style: z
    .custom<SearchStyle>(
      (value) => (HEADER_SEARCH_STYLES as readonly unknown[]).includes(value),
      MAIN_ERROR
    )
    .default("field"),
}

/** Today's header: the wordmark on the left, search, account and cart. */
const headerStandard = z.object({ ...headerCommon, variant: defaultVariant("header_bar") }).strict()

/** The theme setting's centred header, by name only (its drawing is adr/0062 karar 6's). */
const headerCentered = z.object({ ...headerCommon, variant: z.literal("centered") }).strict()

/**
 * The catalog header's menu bar ground and words (adr/0049 Ek 2026-11-15):
 * mirrors `@qticaret/types`' `HEADER_MENU_GROUNDS` and
 * `HEADER_CATALOG_LIMITS`; a unit test keeps them equal.
 */
export const HEADER_MENU_GROUNDS = ["stage", "primary", "well"] as const
export const HEADER_CATALOG_LIMITS = { search_placeholder: 60, strip_note: 80 } as const

type MenuGround = (typeof HEADER_MENU_GROUNDS)[number]

/** One of a list's named steps, its first the default; one off the list is a stale or forged editor. */
const step = <T extends string>(steps: readonly [T, ...T[]]) =>
  z
    .custom<T>((value) => (steps as readonly unknown[]).includes(value), MAIN_ERROR)
    .default(steps[0])

/**
 * N14 (adr/0049 Ek 2026-11-14, Ek 2026-11-15): a utility strip (the shop's
 * top menu, a written account link), the wordmark, a wide search and the
 * shop's phone, then a filled menu bar with a "Kategoriler" button, the
 * main menu, a highlighted last link and the icons. Every setting has a
 * default, so a bar switched to it, or saved before a setting existed,
 * reads whole; a step off its list is a stale or forged editor.
 */
const headerCatalog = z
  .object({
    ...headerCommon,
    variant: z.literal("catalog"),
    /** The search box's words; none: the theme's. */
    search_placeholder: optional(text(HEADER_CATALOG_LIMITS.search_placeholder)),
    /** The search button written ("Ara") rather than a magnifier. */
    search_label: z.boolean().default(false),
    /** "Hesabım" written at the utility strip's end (the icon stays in the menu bar). */
    account_text: z.boolean().default(true),
    /** The cart's subtotal beside its icon. */
    cart_total: z.boolean().default(false),
    /** The menu bar's highlighted last link: its words and where it goes. */
    highlight_link: optional(storefrontLink),
    /** The thin strip above: the shop's top menu and the account link. */
    utility_bar: z.boolean().default(true),
    /** The shop's phone (its store details) beside the search; none there: not drawn. */
    phone: z.boolean().default(true),
    /** The "Kategoriler" button opening the shop's top categories. */
    categories_button: z.boolean().default(true),
    // `light`, the light tint's name before the dictionary had one, reads and is written as `well`
    menu_ground: z
      .custom<MenuGround>(
        (value) => value === "light" || (HEADER_MENU_GROUNDS as readonly unknown[]).includes(value),
        MAIN_ERROR
      )
      .default("stage")
      .transform((value): MenuGround => ((value as unknown) === "light" ? "well" : value)),
    /** Account, favourites and the cart: the menu bar's icons, or named beside the phone. */
    tools_place: step(HEADER_TOOLS_PLACES),
    /** The shop's top links: in the strip (while it shows), or quiet at the menu bar's end. */
    top_links: step(HEADER_TOP_LINKS_PLACES),
    /** The search: wide, or 35 rem right after the wordmark. */
    search_width: step(HEADER_SEARCH_WIDTHS),
    /** A short plain line at the strip's start (a campaign, free shipping); none: no note. */
    strip_note: optional(text(HEADER_CATALOG_LIMITS.strip_note)),
    /** Where the note goes; none, or broken on reading: the note stays plain words. */
    strip_note_link: optional(storefrontLink),
  })
  .strict()

export const headerBar = z.discriminatedUnion(
  "variant",
  [headerStandard, headerCentered, headerCatalog],
  VARIANT_ERROR
)

/**
 * Today's footer: Grafit's ledger of the shop's details, menus and marks,
 * with the footer's own settings (adr/0049 Ek 2026-11-15, `footer-bar.ts`).
 */
export const footerBar = z
  .object({
    ...mainBase,
    type: z.literal("footer_bar"),
    variant: defaultVariant("footer_bar"),
    ...footerBarFields,
  })
  .strict()

/** The product's own block: its gallery and buying column, above the group's other sections. */
export const productMain = z
  .object({
    ...mainBase,
    look: sectionLook.optional(),
    type: z.literal("product_main"),
    variant: defaultVariant("product_main"),
  })
  .strict()

/**
 * Each category variant's own settings, one object per variant (§7: several
 * category layouts are live at once, so `category_main` is the one type
 * that keeps every variant's settings, §2's option C). A variant without
 * one draws with its defaults. Only the default variant so far, which has
 * none: the variants that come (KT1–KT4, adr/0049 §9 F) add their keys.
 */
export const categoryByVariant = z.strictObject({}, MAIN_ERROR)

export type CategoryByVariant = z.infer<typeof categoryByVariant>

/** The variants that keep settings in `by_variant` today (none yet). */
const BY_VARIANT_KEYS: readonly string[] = Object.keys(categoryByVariant.shape)

/**
 * The category's product grid: the shop's default layout (`variant`; a
 * category's own choice is adr/0049 §9 F1's), each variant's settings
 * under `by_variant`. It takes no place in the group's order (`placement`).
 */
export const categoryMain = z
  .object({
    ...mainBase,
    look: sectionLook.optional(),
    type: z.literal("category_main"),
    variant: defaultVariant("category_main"),
    by_variant: categoryByVariant.default({}),
  })
  .strict()

/** Each main section's variants' branches: what a section read as that variant keeps. */
export const MAIN_BRANCHES = {
  header_bar: { standard: headerStandard, centered: headerCentered, catalog: headerCatalog },
  footer_bar: { ledger: footerBar },
  product_main: { standard: productMain },
  category_main: { standard: categoryMain },
} as const satisfies {
  readonly [T in MainSectionType]: Readonly<Record<SectionVariant<T>, VariantBranch>>
}

export type HeaderBar = z.infer<typeof headerBar>
export type HeaderCatalog = z.infer<typeof headerCatalog>
export type FooterBar = z.infer<typeof footerBar>
export type ProductMain = z.infer<typeof productMain>
export type CategoryMain = z.infer<typeof categoryMain>

/**
 * A stored category grid's per-variant settings as today's list reads them
 * (§2.3, forgiving on reading): a variant's object taken off the list since,
 * or written by a newer build, is dropped; the others stand.
 */
export function storedByVariant(section: Record<string, unknown>): Record<string, unknown> {
  const byVariant = section["by_variant"]
  if (section["type"] !== "category_main" || byVariant === undefined) {
    return section
  }
  if (!isPlainObject(byVariant)) {
    return { ...section, by_variant: {} }
  }
  const kept = Object.entries(byVariant).filter(([key]) => BY_VARIANT_KEYS.includes(key))
  return kept.length === Object.keys(byVariant).length
    ? section
    : { ...section, by_variant: Object.fromEntries(kept) }
}
