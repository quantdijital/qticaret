import { Heart, UserRound } from "lucide-react"
import { sectionMark } from "@qticaret/ui"
import type { HeaderCatalogView, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { CategoryMenu } from "./CategoryMenu"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { PHONE_SEARCH } from "./SearchLink"
import { Wordmark } from "./Wordmark"
import { LABELLED, accountOf, allInOf, searchOf } from "./header-words"
import { menuWords } from "./menu-words"

/** An icon on the menu bar: its ground's colours (`header-catalog.css`), 44 px. */
const ON_BAR =
  "gf-on-bar gf-icon-btn text-text transition-colors duration-(--dur-micro) hover:bg-paper-2"

/** Whether the catalog header draws the strip, and the phone beside its search. */
export function catalogParts(shop: ShopView, catalog: HeaderCatalogView) {
  return {
    strip: catalog.utilityBar && (shop.topLinks.length > 0 || catalog.accountText),
    phone: catalog.phone && shop.contact.phone !== null && shop.contact.phoneHref !== null,
  }
}

/**
 * The catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15). From
 * 1024 px: a thin light strip (the shop's top links, "Hesabım" at its
 * end), the wordmark with a wide search and the shop's phone under
 * "Müşteri hizmetleri", then the menu bar on its ground: "Kategoriler"
 * (the shop's top categories in a column, each one's children beside it),
 * the main menu with its dropdowns (`Aisle`), the highlighted last link and
 * account, favourites and the cart with its count (and subtotal, when the
 * shop asks). Sticky, the strip folds away while the page scrolls down
 * (`ScrollCue`, `data-gf-strip`); the search and the menu bar stay. A
 * phone keeps the standard header's rows: the menu, the wordmark,
 * favourites and the cart over the search pill (`data-gf-head-row` folds).
 */
export function HeaderCatalog({
  shop,
  catalog,
  sticky,
  t,
  searchSuggest,
  changeCartLine,
}: {
  shop: ShopView
  catalog: HeaderCatalogView
  sticky: boolean
  t: Translate
  searchSuggest?: string | undefined
  changeCartLine?: ((form: FormData) => Promise<void>) | undefined
}) {
  const menu = menuWords(shop.categories, t)
  // The highlighted link stands right after the main menu's last item (Tezgâh audit Y-05)
  const highlight = catalog.highlight && (
    <a href={catalog.highlight.path} className="gf-btn gf-btn--small shrink-0">
      {catalog.highlight.label}
    </a>
  )
  const search = searchOf(shop, t, searchSuggest, catalog.searchPlaceholder)
  const account = accountOf(shop, t)
  const parts = catalogParts(shop, catalog)
  const cart = {
    cart: shop.cart,
    count: shop.cartQuantity,
    categories: shop.categories,
    change: changeCartLine,
    words: cartSheetWords(t, shop.cartQuantity),
  }
  const total = catalog.cartTotal && shop.cart && shop.cartQuantity > 0 ? shop.cart.subtotal : null
  return (
    <header
      data-gf-head=""
      {...sectionMark(shop.headerBar?.id)}
      className={cn(
        "z-(--z-sticky-nav) border-b border-rule bg-paper",
        sticky ? "gf-head sticky top-0" : "relative"
      )}
      data-variant="catalog"
    >
      {parts.strip && (
        <div data-gf-strip="" className="hidden border-b border-rule bg-paper-2 text-xs lg:block">
          <Container className="flex min-h-9 items-center">
            {shop.topLinks.length > 0 && (
              <nav aria-label={t("nav.top_links")} className="-ml-3 flex flex-wrap items-center">
                {shop.topLinks.map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    className="inline-flex min-h-9 items-center rounded-button px-3 text-text-2 no-underline pointer-coarse:min-h-11 hover:text-text"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
            {catalog.accountText && (
              <a
                href="/hesap"
                className="-mr-3 ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-button px-3 font-semibold text-text no-underline pointer-coarse:min-h-11"
              >
                <UserRound className="size-4" aria-hidden="true" strokeWidth={2} />
                {account}
              </a>
            )}
          </Container>
        </div>
      )}
      <Container
        data-gf-head-row=""
        className="flex h-14 items-center gap-1 lg:h-16 lg:gap-(--space-xl)"
      >
        <MenuSheet
          categories={shop.categories}
          topLinks={shop.topLinks}
          contact={shop.contact}
          highlight={catalog.highlight}
          account={{ label: account, path: "/hesap" }}
          words={{
            open: t("nav.open_menu"),
            title: t("nav.menu"),
            close: t("nav.close"),
            whatsapp: t("home.help_whatsapp"),
            ...menu,
          }}
        />
        <Wordmark name={shop.name} logo={shop.logo} className="mr-auto lg:mr-0" />
        <SearchBox
          {...search}
          id="arama-genis"
          written={catalog.searchLabel}
          className="hidden max-w-180 flex-1 lg:block"
        />
        {parts.phone && (
          <a
            href={shop.contact.phoneHref ?? undefined}
            className="ml-auto hidden min-h-11 shrink-0 flex-col items-end justify-center leading-tight no-underline lg:flex"
          >
            <span className="text-xs text-text-2">{t("nav.customer_service")}</span>
            <span className="tabular text-lg font-extrabold">{shop.contact.phone}</span>
          </a>
        )}
        <nav aria-label={t("nav.account")} className="flex items-center lg:hidden">
          <a href="/hesap/favoriler" aria-label={t("nav.favorites")} className={LABELLED}>
            <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
          </a>
          <CartSheet {...cart} buttonClass={LABELLED} />
        </nav>
      </Container>
      <Container className="pb-2 lg:hidden">
        <SearchBox {...search} id={PHONE_SEARCH} written={catalog.searchLabel} />
      </Container>
      <div className="gf-menubar hidden lg:block" data-ground={catalog.menuGround}>
        <Container>
          <div className="relative flex min-h-13 items-center gap-2 py-1">
            {catalog.categories.length > 0 && (
              <CategoryMenu
                categories={catalog.categories}
                words={{
                  button: t("nav.categories"),
                  label: t("nav.category_menu"),
                  allIn: allInOf(catalog.categories, t),
                }}
              />
            )}
            {shop.categories.length > 0 && (
              <Aisle
                inBar
                categories={shop.categories}
                label={t("nav.categories")}
                words={menu}
                more={t("nav.more")}
                tail={highlight}
              />
            )}
            {shop.categories.length === 0 && highlight}
            <nav aria-label={t("nav.account")} className="ml-auto flex shrink-0 items-center gap-1">
              <a href="/hesap" aria-label={account} className={ON_BAR}>
                <UserRound className="size-6" aria-hidden="true" strokeWidth={1.75} />
              </a>
              <a href="/hesap/favoriler" aria-label={t("nav.favorites")} className={ON_BAR}>
                <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
              </a>
              <CartSheet
                {...cart}
                total={total}
                buttonClass={cn(
                  ON_BAR,
                  "gap-2 px-2 text-sm font-semibold [&_.gf-count]:right-auto [&_.gf-count]:left-6"
                )}
              />
            </nav>
          </div>
        </Container>
      </div>
    </header>
  )
}
