import type { NavCategoryView, ShopView, Translate } from "@qticaret/ui"

/** A header icon with its name under it from 1024 px (account, favourites, cart). */
export const LABELLED =
  "gf-icon-btn gf-tool flex-col gap-0.5 px-2 text-2xs font-semibold leading-none max-lg:size-11 lg:min-w-16 lg:py-1"

/** "Tümünü gör: {name}" for each category path, in words. */
export const allInOf = (categories: readonly NavCategoryView[], t: Translate) =>
  Object.fromEntries(
    categories.map((category) => [category.path, t("nav.see_all", { name: category.label })])
  )

/** The account link's name: the signed-in shopper's own. */
export const accountOf = (shop: ShopView, t: Translate) =>
  shop.customerName ? t("nav.account_of", { name: shop.customerName }) : t("nav.account")

/**
 * The header search's words and live address (both header drawings): its
 * placeholder the shop's when it wrote one (the catalog header), else the
 * storefront's.
 */
export function searchOf(
  shop: ShopView,
  t: Translate,
  searchSuggest: string | undefined,
  placeholder: string | null = null
) {
  return {
    words: {
      label: t("search.label"),
      placeholder: placeholder ?? t("search.placeholder"),
      submit: t("search.submit"),
      clear: t("search.clear"),
      results: t("search.help"),
      products: t("search.suggest.products"),
      categories: t("search.suggest.categories"),
      brands: t("search.suggest.brands"),
      phrases: t("search.suggest.phrases"),
      // Filled in the browser with the answer's own numbers and words
      all: t("search.suggest.all"),
      none: t("search.suggest.none"),
      browse: t("search.suggest.browse"),
      loading: t("search.suggest.loading"),
      error: t("search.suggest.error"),
      found: t("search.suggest.found"),
      priceBefore: t("price.before"),
      from: t("price.from"),
      ...(shop.searchHint ? { hint: shop.searchHint } : {}),
    },
    suggest: searchSuggest,
    // A search that finds nothing offers the shop's own top categories
    browse: shop.categories.slice(0, 6).map(({ label, path }) => ({ label, path })),
  }
}
