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

const headerCommon = {
  ...mainBase,
  type: z.literal("header_bar"),
  /** The header stays at the top of a long page (the theme setting's `header.sticky` before). */
  sticky: z.boolean().default(true),
  /**
   * The menus' category pictures (adr/0049 Ek 2026-11-15): the
   * "Kategoriler" list, the dropdowns and the phone's sheet, whatever the
   * variant; a bar saved before it reads on, as the menus were drawn.
   */
  menu_images: z.boolean().default(true),
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
export const HEADER_CATALOG_LIMITS = { search_placeholder: 60 } as const

type MenuGround = (typeof HEADER_MENU_GROUNDS)[number]

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
