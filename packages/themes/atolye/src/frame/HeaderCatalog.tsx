import { Heart, UserRound } from "lucide-react"
import { fieldMark, sectionMark } from "@qticaret/ui"
import type { HeaderCatalogView, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { BarLinks } from "./AisleMore"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { CategoryMenu } from "./CategoryMenu"
import { HeaderCatalogStrip } from "./HeaderCatalogStrip"
import { HeaderCatalogTools } from "./HeaderCatalogTools"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { SearchDrop } from "./SearchDrop"
import { SearchDropOpener } from "./SearchDropOpener"
import { SearchToggle } from "./SearchToggle"
import { Wordmark } from "./Wordmark"
import { LABELLED, accountOf, allInOf, searchOf } from "./header-words"
import { menuWords } from "./menu-words"

/** An icon on the menu bar: its ground's colours (`header-catalog.css`), 44 px; hovered, the menus' look. */
const ON_BAR = "gf-on-bar gf-icon-btn gf-tool text-text transition-colors duration-(--dur-micro)"

/**
 * What the catalog header draws: the strip and what it holds (the shop's
 * note, its top links while they stand there, "Hesabım" beside the menu
 * bar's icons), whether it says the top links anywhere (the strip or the
 * menu bar's end, `links`: the bar above then leaves them out) and the
 * phone beside its search.
 */
export function catalogParts(shop: ShopView, catalog: HeaderCatalogView) {
  const stripLinks = catalog.topLinksPlace !== "bar" && shop.topLinks.length > 0
  const stripAccount = catalog.accountText && catalog.toolsPlace !== "row"
  const stripNote = catalog.stripNote ?? null
  return {
    strip: catalog.utilityBar && (stripLinks || stripAccount || stripNote !== null),
    stripLinks,
    stripAccount,
    stripNote,
    links: shop.topLinks.length > 0 && (catalog.topLinksPlace === "bar" || catalog.utilityBar),
    phone: catalog.phone && shop.contact.phone !== null && shop.contact.phoneHref !== null,
  }
}

/** The narrow search (`search_width: narrow`): 35 rem at most, right after the wordmark. */
const NARROW_SEARCH = "lg:[&>[role=search]]:max-w-140"

/**
 * The catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15). From
 * 1024 px: a thin light strip (`HeaderCatalogStrip`: the shop's note, its top links, "Hesabım" at its
 * end), the wordmark with a wide search and the shop's phone under
 * "Müşteri hizmetleri", then the menu bar on its ground: "Kategoriler"
 * (the shop's top categories in a column, each one's children beside it),
 * the main menu with its dropdowns (`Aisle`), the highlighted last link and
 * account, favourites and the cart with its count (and subtotal, when the
 * shop asks). Sticky, the strip folds away while the page scrolls down
 * (`ScrollCue`, `data-gf-strip`); the search and the menu bar stay. A
 * phone keeps the standard header's row: the menu, the wordmark,
 * favourites and the cart (`data-gf-head-row` folds), the search dropping
 * from the top on the bottom bar's "Ara" (`SearchDrop`, as every header).
 *
 * Its layout choices (Ek 2026-11-15; each default the drawing above):
 * the tools named in the top row after the phone (`toolsPlace: row`,
 * `HeaderCatalogTools`), the top links quiet at the menu bar's end
 * (`topLinksPlace: bar`, `Aisle`'s `links`), the search 35 rem
 * (`searchWidth: narrow`). Every header's `searchStyle: icon` puts a
 * magnifier before the phone that opens the box as wide (`SearchToggle`).
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
  // The menus' small pictures (adr/0049 Ek 2026-11-15): the dropdowns and the sheet unless the
  // shop said none, "Kategoriler" only when it asked for them everywhere
  const images = shop.headerBar?.menuImages ?? "submenus"
  const pictures = images !== "off"
  // The highlighted link stands right after the main menu's last item (Tezgâh audit Y-05)
  const highlight = catalog.highlight && (
    <a
      href={catalog.highlight.path}
      className="gf-btn gf-btn--small shrink-0"
      {...fieldMark(shop.editor, "highlight_link")}
    >
      {catalog.highlight.label}
    </a>
  )
  const box = {
    ...searchOf(shop, t, searchSuggest, catalog.searchPlaceholder),
    written: catalog.searchLabel,
    marks: shop.editor,
  }
  const icon = shop.headerBar?.searchStyle === "icon"
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
  const row = catalog.toolsPlace === "row"
  const barLinks = catalog.topLinksPlace === "bar" ? shop.topLinks : []
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
        <HeaderCatalogStrip
          note={parts.stripNote}
          links={parts.stripLinks ? shop.topLinks : []}
          account={parts.stripAccount ? account : null}
          marks={shop.editor}
          words={{ links: t("nav.top_links") }}
        />
      )}
      <Container
        data-gf-head-row=""
        className={cn(
          "flex h-14 items-center gap-1 lg:h-16 lg:gap-(--space-xl)",
          catalog.searchWidth === "narrow" && NARROW_SEARCH
        )}
      >
        <MenuSheet
          categories={shop.categories}
          topLinks={shop.topLinks}
          contact={shop.contact}
          pictures={pictures}
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
        {icon ? (
          // The magnifier opens the box as wide as `searchWidth` draws it (adr/0049 Ek 2026-11-15)
          <SearchToggle
            {...box}
            id="arama-genis"
            align="end"
            openLabel={t("search.open")}
            className={
              catalog.searchWidth === "narrow"
                ? "[--gf-search-open:35rem]"
                : "[--gf-search-open:45rem]"
            }
          />
        ) : (
          <SearchBox {...box} id="arama-genis" className="hidden max-w-180 flex-1 lg:block" />
        )}
        {parts.phone && (
          <a
            href={shop.contact.phoneHref ?? undefined}
            className="ml-auto hidden min-h-11 shrink-0 flex-col items-end justify-center leading-tight no-underline lg:flex"
          >
            <span className="text-xs text-text-2">{t("nav.customer_service")}</span>
            <span className="tabular text-lg font-extrabold">{shop.contact.phone}</span>
          </a>
        )}
        {/* The editor's preview draws no bottom bar: a phone's way into the dropping search there */}
        {shop.editor && <SearchDropOpener label={t("search.open")} className={LABELLED} />}
        {row ? (
          <HeaderCatalogTools
            account={account}
            cart={cart}
            total={total}
            alone={!parts.phone}
            t={t}
          />
        ) : (
          <nav aria-label={t("nav.account")} className="flex items-center lg:hidden">
            <a href="/hesap/favoriler" aria-label={t("nav.favorites")} className={LABELLED}>
              <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
            </a>
            <CartSheet {...cart} buttonClass={LABELLED} />
          </nav>
        )}
      </Container>
      <SearchDrop {...box} title={t("search.title")} closeLabel={t("search.close")} />
      <div className="gf-menubar hidden lg:block" data-ground={catalog.menuGround}>
        <Container>
          <div className="relative flex min-h-13 items-center gap-2 py-1">
            {catalog.categories.length > 0 && (
              <CategoryMenu
                categories={catalog.categories}
                pictures={images === "all"}
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
                pictures={pictures}
                mega={shop.headerBar?.submenuStyle === "mega"}
                links={barLinks}
                linksLabel={t("nav.top_links")}
              />
            )}
            {shop.categories.length === 0 && highlight}
            {shop.categories.length === 0 && barLinks.length > 0 && (
              <BarLinks links={barLinks} label={t("nav.top_links")} className="ml-auto" />
            )}
            {!row && (
              <nav
                aria-label={t("nav.account")}
                className={cn(
                  "ml-auto flex shrink-0 items-center gap-1",
                  // After the links standing at the bar's end on their own
                  shop.categories.length === 0 && barLinks.length > 0 && "ml-0"
                )}
              >
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
            )}
          </div>
        </Container>
      </div>
    </header>
  )
}
