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
  ImageView,
  NavCategoryView,
  ProductMainView,
  SectionLookView,
  Translate,
} from "@qticaret/ui"
import { headerCatalogOf } from "./header-catalog"

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
    ...(variant === "catalog" && parts
      ? { catalog: headerCatalogOf(bar.catalog, parts.t, parts.tree) }
      : {}),
  }
}

/** A footer setting's step as a reader takes it: one on the list as it is, anything else the default. */
const footerStep = <S extends FooterBarSetting>(setting: S, value: unknown): FooterBarStep<S> => {
  const listed: readonly unknown[] = FOOTER_BAR_SETTINGS[setting]
  return listed.includes(value) ? (value as FooterBarStep<S>) : FOOTER_BAR_DEFAULTS[setting]
}

const isBadge = (value: unknown): value is PaymentBadge =>
  (PAYMENT_BADGES as readonly unknown[]).includes(value)

/**
 * The footer with its own settings (adr/0049 Ek 2026-11-15): each read
 * forgivingly (a step this build does not know is the default, a way to
 * pay it does not know is left out, a repeat too); a backend before them
 * prints none, and the footer is drawn as before.
 */
export function footerBarOf(
  main: Main,
  t: Translate,
  logo: ImageView | null = null
): FooterBarView {
  const bar = main?.footer_bar
  const social = footerStep("social", bar?.social)
  // The store profile's logo over the contact when the shop chose it and has one; else the name
  const named = footerStep("brand", bar?.brand) === "logo" && logo !== null
  const badges = [...new Set((bar?.payment_badges ?? []).filter(isBadge))]
  return {
    id: bar?.id ?? "mainfooter",
    variant: variantOf("footer_bar", bar?.variant),
    ...(social !== FOOTER_BAR_DEFAULTS.social ? { social } : {}),
    ...(named ? { logo } : {}),
    ...(badges.length > 0
      ? { paymentBadges: badges.map((key) => ({ key, label: t(`marks.${key}`) })) }
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

export const productMainOf = (main: Main): ProductMainView => ({
  id: main?.product_main.id ?? "mainproduct",
  variant: variantOf("product_main", main?.product_main.variant),
  ...withLook(main?.product_main.look),
})

export const categoryMainOf = (main: Main): CategoryMainView => ({
  id: main?.category_main.id ?? "maincategory",
  variant: variantOf("category_main", main?.category_main.variant),
  ...withLook(main?.category_main.look),
})
