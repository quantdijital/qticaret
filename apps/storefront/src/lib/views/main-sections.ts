import type {
  FooterBarSetting,
  FooterBarStep,
  PaymentBadge,
  StoreLayout,
  StoreThemeSettings,
} from "@qticaret/types"
import { lookOf } from "@qticaret/types/section-look"
import {
  headerMenuImagesOf,
  headerSearchStyleOf,
  headerToolsStyleOf,
  productImageRatioOf,
  variantOf,
} from "@qticaret/types/section-variants"
import {
  FOOTER_BAR_DEFAULTS,
  FOOTER_BAR_SETTINGS,
  PAYMENT_BADGES,
} from "@qticaret/types/section-footer"
import type {
  CategoryMainView,
  FooterBarView,
  HeaderBarView,
  NavCategoryView,
  ProductMainView,
  SectionLookView,
  Translate,
} from "@qticaret/ui"
import { shopMarks } from "./card-extras"
import { footerColumnsOf } from "./footer-columns"
import type { FooterLogos } from "./footer-logo"
import { footerRowsOf, freeRowsOf } from "./footer-rows"
import type { FooterRowsParts } from "./footer-rows"
import { headerCatalogOf } from "./header-catalog"
import { menuLink } from "./menus"

/**
 * The design's main sections as a theme draws them (adr/0049 Ek 2026-11-14
 * §5, §7): each with its id and a variant the contract knows (one it does
 * not, the default); the product's block and the category grid with the
 * look the shop set. A backend before them gives none: the header reads
 * the theme's `header` as it did (`centered` is the bar's `centered`), the
 * rest their defaults, so the page is as before.
 */

type Main = StoreLayout["main"]

const withLook = (look: unknown): { look?: SectionLookView } => {
  const set = lookOf(look)
  return Object.keys(set).length > 0 ? { look: set } : {}
}

/** What the catalog header is drawn with beside its settings: the words and the category tree. */
export interface HeaderBarParts {
  t: Translate
  tree: () => NavCategoryView[]
}

export function headerBarOf(
  main: Main,
  theme: Pick<StoreThemeSettings, "header">,
  parts?: HeaderBarParts
): HeaderBarView {
  const bar = main?.header_bar
  if (!bar) {
    return {
      id: "mainheader",
      variant: theme.header.layout === "centered" ? "centered" : "standard",
      sticky: theme.header.sticky,
      menuImages: "submenus",
      searchStyle: "field",
    }
  }
  const variant = variantOf("header_bar", bar.variant)
  return {
    id: bar.id,
    variant,
    sticky: bar.sticky,
    // A backend before the setting prints none: the submenus' pictures, as drawn before
    menuImages: headerMenuImagesOf(bar.menu_images),
    // A backend before the search's look prints none: the box, as drawn before
    searchStyle: headerSearchStyleOf(bar.search_style),
    // The one-row header's plain tools only once chosen: a bar without them is the view it was
    ...(headerToolsStyleOf(bar.tools_style) === "plain" ? { toolsStyle: "plain" as const } : {}),
    ...(variant === "catalog" && parts
      ? { catalog: headerCatalogOf(bar.catalog, parts.t, parts.tree) }
      : {}),
    // The other variants' action button, as the catalog's (none, or broken: no button)
    ...(variant !== "catalog" && bar.highlight_link && parts
      ? { highlight: menuLink({ ...bar.highlight_link, children: [] }, parts.t) }
      : {}),
  }
}

/** A footer setting's step as a reader takes it: one on the list as it is, anything else the default. */
const footerStep = <S extends FooterBarSetting>(setting: S, value: unknown): FooterBarStep<S> => {
  const listed: readonly unknown[] = FOOTER_BAR_SETTINGS[setting]
  return listed.includes(value) ? (value as FooterBarStep<S>) : FOOTER_BAR_DEFAULTS[setting]
}

/** What the free rows footer's blocks are filled with, beyond the words and the logos. */
export type FreeRowsParts = Omit<FooterRowsParts, "t" | "logos">

const isBadge = (value: unknown): value is PaymentBadge =>
  (PAYMENT_BADGES as readonly unknown[]).includes(value)

/**
 * The footer with its own settings (adr/0049 Ek 2026-11-15): each read
 * forgivingly (a step this build does not know is the default, a way to
 * pay it does not know is left out, a repeat too); a backend before them
 * prints none, and the footer is drawn as before. The shop's logo, when it
 * has one, names it over the contact (owner 2026-11-16: the header's logo,
 * in the footer too); none, its name. On the stage the dark-ground logo
 * (`footerLogosOf`), each free row by its own ground.
 */
export function footerBarOf(
  main: Main,
  t: Translate,
  logos: FooterLogos | null = null,
  rows?: FreeRowsParts
): FooterBarView {
  const bar = main?.footer_bar
  const social = footerStep("social", bar?.social)
  const badges = [...new Set((bar?.payment_badges ?? []).filter(isBadge))]
  const variant = variantOf("footer_bar", bar?.variant)
  // The brand columns footer draws a card network by its own mark; the ledger writes its name
  const columns = variant === "brand_columns"
  // The free rows footer too (adr/0070), its rows filled with the shop's details
  const free = variant === "free_rows" && rows !== undefined
  const marks = shopMarks(badges, t)
  const columnsView = columns ? footerColumnsOf(bar?.columns) : null
  const freeView = free ? freeRowsOf(bar) : null
  // The ledger stands on the light well; the other two on the ground the shop picks
  const dark = (columnsView ?? freeView)?.ground === "stage"
  const logo = (dark ? logos?.dark : logos?.light) ?? null
  return {
    id: bar?.id ?? "mainfooter",
    variant,
    ...(social !== FOOTER_BAR_DEFAULTS.social ? { social } : {}),
    ...(logo ? { logo } : {}),
    ...(badges.length > 0
      ? {
          paymentBadges:
            columns || free ? marks : badges.map((key) => ({ key, label: t(`marks.${key}`) })),
        }
      : {}),
    ...(columnsView ? { columns: columnsView } : {}),
    ...(free && freeView
      ? {
          freeRows: freeView,
          rows: footerRowsOf(
            bar?.rows,
            {
              ...rows,
              t,
              logos: logos ?? { light: null, dark: null, primary: null },
              payments: marks.length > 0 ? marks : rows.payments,
            },
            dark
          ),
        }
      : {}),
    ...(bar?.back_to_top === true
      ? {
          backToTop: {
            side: footerStep("back_to_top_side", bar.back_to_top_side),
            shape: footerStep("back_to_top_shape", bar.back_to_top_shape),
            mobile: bar.back_to_top_mobile !== false,
          },
        }
      : {}),
  }
}

export const productMainOf = (main: Main): ProductMainView => {
  const ratio = productImageRatioOf(main?.product_main.image_ratio)
  return {
    id: main?.product_main.id ?? "mainproduct",
    variant: variantOf("product_main", main?.product_main.variant),
    // The square is the page as before: no field
    ...(ratio === "square" ? {} : { imageRatio: ratio }),
    ...withLook(main?.product_main.look),
  }
}

export const categoryMainOf = (main: Main): CategoryMainView => ({
  id: main?.category_main.id ?? "maincategory",
  variant: variantOf("category_main", main?.category_main.variant),
  ...withLook(main?.category_main.look),
})
