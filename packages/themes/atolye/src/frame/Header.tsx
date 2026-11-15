import { Heart, UserRound } from "lucide-react"
import { drawnVariant } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { menuWords } from "./menu-words"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { PHONE_SEARCH } from "./SearchLink"
import { Wordmark } from "./Wordmark"

const LABELLED =
  "gf-icon-btn flex-col gap-0.5 px-2 text-2xs font-semibold leading-none max-lg:size-11 lg:min-w-16 lg:py-1"

/** The header bar's variants this theme draws (`drawnVariant`). */
export const HEADER_VARIANTS = ["standard", "centered"] as const

/**
 * The header, sticky unless the shop says not, in the design's variant
 * (adr/0049 Ek 2026-11-14 §5; the theme's `header.layout` "centered" is
 * the bar's `centered`, adr/0062 karar 10). A phone, both: a 56 px row
 * (the menu, the wordmark, favourites, the cart with its count) over the
 * 48 px search pill, 112 px in all; centred, the wordmark stands in the
 * row's middle. From 1024 px, standard: the wordmark, a wide search in
 * the middle, account, favourites and cart with their names under them;
 * centred: the search on the left (22 rem at most), the wordmark in the
 * middle, the same three tools on the right, the aisle centred under
 * them. The keyboard meets the search, the wordmark, then the tools.
 * Each aisle category with children opens its dropdown. Both searches
 * show their live panel as the shopper types once the storefront gives
 * its address. Sticky, it folds while the page scrolls down (`frame.css`,
 * `ScrollCue`): the aisle from 1024 px, the top row on a phone; the
 * search always stays.
 */
export function Header({
  shop,
  t,
  searchSuggest,
  changeCartLine,
}: {
  shop: ShopView
  t: Translate
  /** The storefront's live search address; none: the plain search form. */
  searchSuggest?: string | undefined
  /** The cart drawer's quantity and remove buttons; none: its lines read only. */
  changeCartLine?: ((form: FormData) => Promise<void>) | undefined
}) {
  const menu = menuWords(shop.categories, t)
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
  // The design's header bar (adr/0049 Ek 2026-11-14 §5): a variant this theme lacks falls
  // to the standard drawing; its own `sticky` over the theme's
  const variant = drawnVariant("header_bar", shop.headerBar?.variant, HEADER_VARIANTS)
  const centered = variant === "centered"
  const sticky = shop.headerBar?.sticky ?? shop.theme.header.sticky
  const account = shop.customerName
    ? t("nav.account_of", { name: shop.customerName })
    : t("nav.account")

  const sheet = (
    <MenuSheet
      categories={shop.categories}
      topLinks={shop.topLinks}
      contact={shop.contact}
      words={{
        open: t("nav.open_menu"),
        title: t("nav.menu"),
        close: t("nav.close"),
        whatsapp: t("home.help_whatsapp"),
        ...menu,
      }}
    />
  )
  const wideSearch = (className: string) => (
    <SearchBox {...search} id="arama-genis" className={cn("hidden flex-1 lg:block", className)} />
  )
  const tools = (
    <nav
      aria-label={t("nav.account")}
      className={cn("flex items-center lg:gap-1", centered ? "justify-self-end" : "lg:ml-auto")}
    >
      <a href="/hesap" aria-label={account} className={cn(LABELLED, "max-lg:hidden")}>
        <UserRound className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true" className="max-lg:hidden">
          {t("nav.account")}
        </span>
      </a>
      {/* Named as it reads (WCAG 2.5.3): a voice user says the word on screen */}
      <a href="/hesap/favoriler" aria-label={t("nav.favorites")} className={LABELLED}>
        <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true" className="max-lg:hidden">
          {t("nav.favorites")}
        </span>
      </a>
      <CartSheet
        cart={shop.cart}
        count={shop.cartQuantity}
        categories={shop.categories}
        change={changeCartLine}
        buttonClass={LABELLED}
        words={cartSheetWords(t, shop.cartQuantity)}
      />
    </nav>
  )

  return (
    <header
      data-gf-head=""
      className={cn(
        "z-(--z-sticky-nav) border-b border-rule bg-paper",
        sticky ? "gf-head sticky top-0" : "relative"
      )}
      data-variant={variant}
    >
      {centered ? (
        <Container
          data-gf-head-row=""
          className="gf-head-row grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 lg:h-20 lg:gap-(--space-lg)"
        >
          <div className="flex min-w-0 items-center">
            {sheet}
            {wideSearch("max-w-88")}
          </div>
          {/* A long name truncates before it pushes the menu or the cart off a phone's row */}
          <Wordmark
            name={shop.name}
            logo={shop.logo}
            className="max-w-[calc(100vw-15rem)] justify-self-center lg:max-w-120"
          />
          {tools}
        </Container>
      ) : (
        <Container
          data-gf-head-row=""
          className="gf-head-row flex h-14 items-center gap-1 lg:h-20 lg:gap-(--space-xl)"
        >
          {sheet}
          <Wordmark name={shop.name} logo={shop.logo} className="mr-auto lg:mr-0" />
          {wideSearch("max-w-160")}
          {tools}
        </Container>
      )}
      <Container className="pb-2 lg:hidden">
        <SearchBox {...search} id={PHONE_SEARCH} />
      </Container>
      {shop.categories.length > 0 && (
        <Container data-gf-aisle="" className="hidden lg:block">
          <Aisle
            categories={shop.categories}
            label={t("nav.categories")}
            words={menu}
            centered={centered}
          />
        </Container>
      )}
    </header>
  )
}
