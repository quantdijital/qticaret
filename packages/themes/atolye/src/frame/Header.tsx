import { Heart, UserRound } from "lucide-react"
import { drawnVariant } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { PHONE_SEARCH } from "./SearchLink"
import { Wordmark } from "./Wordmark"
import { HeaderCatalog, catalogParts } from "./HeaderCatalog"
import { LABELLED, accountOf, allInOf, searchOf } from "./header-words"

/** The catalog header's strip and phone when the shop's bar is drawn as it (else null). */
export function catalogOf(shop: ShopView) {
  const catalog = shop.headerBar?.catalog
  return catalog && drawnVariant("header_bar", shop.headerBar?.variant, ["catalog"]) === "catalog"
    ? catalogParts(shop, catalog)
    : null
}

/**
 * The header, sticky unless the shop says not. A phone: a 56 px row (the
 * menu, the wordmark, favourites, the cart with its count) over the 48 px
 * search pill, 112 px in all. From 1024 px: the wordmark, a wide search
 * in the middle, account, favourites and cart with their names under
 * them; the category aisle below, each category with children opening
 * its panel. Both searches show their live panel as the shopper types
 * once the storefront gives its address. Sticky, it folds while the page
 * scrolls down (`frame.css`, `ScrollCue`): the aisle from 1024 px, the
 * top row on a phone; the search always stays.
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
  // The design's header bar (adr/0049 Ek 2026-11-14 §5): `catalog` is its own drawing (N14),
  // the rest fall to this one (`centered` is adr/0062 karar 6's); its own `sticky` over the theme's
  const variant = drawnVariant("header_bar", shop.headerBar?.variant, ["standard", "catalog"])
  const sticky = shop.headerBar?.sticky ?? shop.theme.header.sticky
  if (variant === "catalog" && shop.headerBar?.catalog) {
    return (
      <HeaderCatalog
        shop={shop}
        catalog={shop.headerBar.catalog}
        sticky={sticky}
        t={t}
        searchSuggest={searchSuggest}
        changeCartLine={changeCartLine}
      />
    )
  }
  const allIn = allInOf(shop.categories, t)
  const search = searchOf(shop, t, searchSuggest)
  const account = accountOf(shop, t)
  return (
    <header
      data-gf-head=""
      className={cn(
        "z-(--z-sticky-nav) border-b border-rule bg-paper",
        sticky ? "gf-head sticky top-0" : "relative"
      )}
      data-variant={variant === "catalog" ? "standard" : variant}
    >
      <Container
        data-gf-head-row=""
        className="gf-head-row flex h-14 items-center gap-1 lg:h-20 lg:gap-(--space-xl)"
      >
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
      </Container>
      <Container className="pb-2 lg:hidden">
        <SearchBox {...search} id={PHONE_SEARCH} />
      </Container>
      {shop.categories.length > 0 && (
        <Container data-gf-aisle="" className="hidden lg:block">
          <Aisle
            categories={shop.categories}
            label={t("nav.categories")}
            allIn={allIn}
            seeAll={t("categories.see_all")}
          />
        </Container>
      )}
    </header>
  )
}
