import { Heart, UserRound } from "lucide-react"
import { drawnVariant, sectionMark } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { menuWords } from "./menu-words"
import { MenuSheet } from "./MenuSheet"
import { SearchBox } from "./SearchBox"
import { SearchDrop } from "./SearchDrop"
import { SearchDropOpener } from "./SearchDropOpener"
import { SearchToggle } from "./SearchToggle"
import { Wordmark } from "./Wordmark"
import { HeaderCatalog, catalogParts } from "./HeaderCatalog"
import { LABELLED, accountOf, searchOf } from "./header-words"

/** The catalog header's strip and phone when the shop's bar is drawn as it (else null). */
export function catalogOf(shop: ShopView) {
  const catalog = shop.headerBar?.catalog
  return catalog && drawnVariant("header_bar", shop.headerBar?.variant, ["catalog"]) === "catalog"
    ? catalogParts(shop, catalog)
    : null
}

/** The header bar's variants this theme draws (`drawnVariant`). */
export const HEADER_VARIANTS = ["standard", "centered", "catalog"] as const

/**
 * The header, sticky unless the shop says not, in the design's variant
 * (adr/0049 Ek 2026-11-14 §5; the theme's `header.layout` "centered" is
 * the bar's `centered`, adr/0062 karar 10; `catalog`, N14, is
 * `HeaderCatalog`'s own drawing). A phone, both: its 56 px row alone
 * (the menu, the wordmark, favourites, the cart with its count), no
 * search box; the bottom bar's "Ara" drops the search down from the top
 * (`SearchDrop`; the editor's preview, which has no bottom bar, puts a
 * magnifier in the row for it, `SearchDropOpener`), in every variant and
 * whatever the search style (owner 2026-11-16). Centred, the wordmark
 * stands in the row's middle. From 1024 px, standard: the wordmark, a
 * wide search in the middle, account, favourites and cart with their
 * names under them; centred: the search on the left (22 rem at most),
 * the wordmark in the middle, the same three tools on the right, the
 * aisle centred under them. The keyboard meets the search, the wordmark,
 * then the tools. Each aisle category with children opens its dropdown.
 * Both searches show their live panel as the shopper types once the
 * storefront gives its address. Sticky, it folds while the page scrolls
 * down (`frame.css`, `ScrollCue`): the aisle from 1024 px, where the
 * search stays; the top row, the whole header, on a phone. The shop may
 * ask for its search as an icon (`searchStyle: icon`, adr/0049 Ek
 * 2026-11-15): from 1024 px a magnifier in the box's place opens it
 * (`SearchToggle`).
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
  // `centered` and `standard` are drawn here, a variant this theme lacks falls to the
  // standard drawing; its own `sticky` over the theme's
  const variant = drawnVariant("header_bar", shop.headerBar?.variant, HEADER_VARIANTS)
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
  const centered = variant === "centered"
  // The dropdowns' and the sheet's pictures unless the shop chose none (adr/0049 Ek 2026-11-15)
  const pictures = shop.headerBar?.menuImages !== "off"
  const menu = menuWords(shop.categories, t)
  const search = searchOf(shop, t, searchSuggest)
  const account = accountOf(shop, t)

  const sheet = (
    <MenuSheet
      categories={shop.categories}
      topLinks={shop.topLinks}
      contact={shop.contact}
      pictures={pictures}
      words={{
        open: t("nav.open_menu"),
        title: t("nav.menu"),
        close: t("nav.close"),
        whatsapp: t("home.help_whatsapp"),
        ...menu,
      }}
    />
  )
  // The search as a magnifier that opens it (adr/0049 Ek 2026-11-15), as wide as the box
  const icon = shop.headerBar?.searchStyle === "icon"
  const wideSearch = (className: string, align: "start" | "end", opened: string) =>
    icon ? (
      <SearchToggle
        {...search}
        id="arama-genis"
        align={align}
        openLabel={t("search.open")}
        className={opened}
      />
    ) : (
      <SearchBox {...search} id="arama-genis" className={cn("hidden flex-1 lg:block", className)} />
    )
  // The editor's preview draws no bottom bar: a phone's way into the dropping search there
  const opener = shop.editor ? (
    <SearchDropOpener label={t("search.open")} className={LABELLED} />
  ) : null
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
      {...sectionMark(shop.headerBar?.id)}
      className={cn(
        "z-(--z-sticky-nav) border-b border-rule bg-paper",
        sticky ? "gf-head sticky top-0" : "relative"
      )}
      data-variant={variant === "catalog" ? "standard" : variant}
    >
      {centered ? (
        <Container
          data-gf-head-row=""
          className="gf-head-row grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 lg:h-20 lg:gap-(--space-lg)"
        >
          <div className="flex min-w-0 items-center">
            {sheet}
            {opener}
            {wideSearch("max-w-88", "start", "[--gf-search-open:22rem]")}
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
          {wideSearch("max-w-160", "end", "[--gf-search-open:40rem]")}
          {opener}
          {tools}
        </Container>
      )}
      <SearchDrop {...search} title={t("search.title")} closeLabel={t("search.close")} />
      {shop.categories.length > 0 && (
        <Container data-gf-aisle="" className="hidden lg:block">
          <Aisle
            categories={shop.categories}
            label={t("nav.categories")}
            words={menu}
            centered={centered}
            pictures={pictures}
          />
        </Container>
      )}
    </header>
  )
}
