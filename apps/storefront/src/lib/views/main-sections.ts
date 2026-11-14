import type { StoreLayout, StoreThemeSettings } from "@qticaret/types"
import { lookOf } from "@qticaret/types/section-look"
import { variantOf } from "@qticaret/types/section-variants"
import type {
  CategoryMainView,
  FooterBarView,
  HeaderBarView,
  ProductMainView,
  SectionLookView,
} from "@qticaret/ui"

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

export function headerBarOf(main: Main, theme: Pick<StoreThemeSettings, "header">): HeaderBarView {
  const bar = main?.header_bar
  if (!bar) {
    return {
      id: "mainheader",
      variant: theme.header.layout === "centered" ? "centered" : "standard",
      sticky: theme.header.sticky,
    }
  }
  return {
    id: bar.id,
    variant: variantOf("header_bar", bar.variant),
    sticky: bar.sticky,
  }
}

export const footerBarOf = (main: Main): FooterBarView => ({
  id: main?.footer_bar.id ?? "mainfooter",
  variant: variantOf("footer_bar", main?.footer_bar.variant),
})

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
