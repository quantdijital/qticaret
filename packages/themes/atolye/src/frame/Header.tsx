import { Heart, UserRound } from "lucide-react"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { Wordmark } from "./Wordmark"

const LABELLED =
  "gf-icon-btn flex-col gap-0.5 px-2 text-2xs font-semibold leading-none max-lg:size-11 lg:min-w-16 lg:py-1"

/**
 * The header, sticky unless the shop says not. A phone: a 56 px row (the
 * menu, the wordmark, favourites, the cart with its count) over the 48 px
 * search pill, 112 px in all. From 1024 px: the wordmark, a wide search
 * in the middle, account, favourites and cart with their names under
 * them; the category aisle below, each category with children opening
 * its panel. Both searches show their live panel as the shopper types
 * once the storefront gives its address.
 */
export function Header({
  shop,
  t,
  searchSuggest,
}: {
  shop: ShopView
  t: Translate
  /** The storefront's live search address; none: the plain search form. */
  searchSuggest?: string | undefined
}) {
  const allIn = Object.fromEntries(
    shop.categories.map((category) => [category.path, t("nav.see_all", { name: category.label })])
  )
  const search = {
    words: {
      label: t("search.label"),
      placeholder: t("search.placeholder"),
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
    },
    suggest: searchSuggest,
    // A search that finds nothing offers the shop's own top categories
    browse: shop.categories.slice(0, 6).map(({ label, path }) => ({ label, path })),
  }
  const account = shop.customerName
    ? t("nav.account_of", { name: shop.customerName })
    : t("nav.account")
  return (
    <header
      className={cn(
        "z-(--z-sticky-nav) border-b border-rule bg-paper",
        shop.theme.header.sticky ? "sticky top-0" : "relative"
      )}
    >
      <Container className="flex h-14 items-center gap-1 lg:h-20 lg:gap-(--space-xl)">
        <MenuSheet
          categories={shop.categories}
          topLinks={shop.topLinks}
          contact={shop.contact}
          words={{
            open: t("nav.open_menu"),
            title: t("nav.menu"),
            close: t("nav.close"),
            allIn,
            whatsapp: t("home.help_whatsapp"),
          }}
        />
        <Wordmark name={shop.name} logo={shop.logo} className="mr-auto lg:mr-0" />
        <SearchBox {...search} id="arama-genis" className="hidden max-w-160 flex-1 lg:block" />
        <nav aria-label={t("nav.account")} className="flex items-center lg:ml-auto lg:gap-1">
          <a href="/hesap" aria-label={account} className={cn(LABELLED, "max-lg:hidden")}>
            <UserRound className="size-6" aria-hidden="true" strokeWidth={1.75} />
            <span aria-hidden="true" className="max-lg:hidden">
              {t("nav.account")}
            </span>
          </a>
          <a href="/hesap/favoriler" aria-label={t("account.favorites")} className={LABELLED}>
            <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
            <span aria-hidden="true" className="max-lg:hidden">
              {t("nav.favorites")}
            </span>
          </a>
          <CartSheet
            cart={shop.cart}
            count={shop.cartQuantity}
            buttonClass={LABELLED}
            words={{
              label: t("nav.cart_label", { count: shop.cartQuantity }),
              short: t("nav.bottom.cart"),
              title: t("cart.title_count", { count: shop.cartQuantity }),
              empty: t("cart.empty"),
              continue: t("cart.continue"),
              subtotal: t("cart.subtotal"),
              note: t("cart.drawer_note"),
              viewCart: t("cart.view"),
              checkout: t("cart.checkout"),
              close: t("nav.close"),
              quantity: t("order.quantity"),
            }}
          />
        </nav>
      </Container>
      <Container className="pb-2 lg:hidden">
        <SearchBox {...search} id="arama-dar" />
      </Container>
      {shop.categories.length > 0 && (
        <Container className="hidden lg:block">
          <Aisle categories={shop.categories} label={t("nav.categories")} allIn={allIn} />
        </Container>
      )}
    </header>
  )
}
