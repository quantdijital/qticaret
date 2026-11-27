import { ArrowRight, Heart, UserRound } from "lucide-react"
import { fieldMark, sectionMark } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Aisle } from "./Aisle"
import { CartSheet } from "./CartSheet"
import { cartSheetWords } from "./cart-sheet-words"
import { menuWords } from "./menu-words"
import { MenuSheet } from "./MenuSheet"
import { SearchDrop } from "./SearchDrop"
import { SearchDropOpener } from "./SearchDropOpener"
import { SearchToggle } from "./SearchToggle"
import { Wordmark } from "./Wordmark"
import { accountOf, searchOf } from "./header-words"

/** A round tool (`header.css`, `[data-variant="inline"]`): its ring, ground and icon size there. */
const TOOL = "gf-icon-btn gf-tool"

/**
 * The one-row header (`header_bar` `inline`, "Tek satır"): from 1024 px the
 * wordmark at the start, the shop's main menu in the row's middle (the
 * aisle, each category with children opening its dropdown, the page's own
 * link marked in the accent colour) and round tools at the end: the
 * search as a magnifier (`SearchToggle`), favourites, the cart and the
 * account, in a 96 px row with a logo a step taller. No second row and no
 * top strip of links or phone: the shop's top links and phone are in
 * the menu sheet. A phone, as every header: its 56 px row (the menu, the
 * wordmark, favourites, the cart), the search dropping from the bottom
 * bar's "Ara" (`SearchDrop`). Sticky unless the shop says not; it folds
 * while the page scrolls down on a phone, as the others (`frame.css`).
 * With plain tools (`toolsStyle: plain`) the row is 72 px with the logo at
 * its own size, the search, account and cart small plain icons and the
 * shop's action button after them as a pill with an arrow; favourites stay
 * in the phone's row, the menu sheet and the account.
 * Over the opening (`overCover`): marked for `header-over.css`, which lays
 * it see-through over a first full photograph opening until the page scrolls.
 */
export function HeaderInline({
  shop,
  t,
  sticky,
  searchSuggest,
  changeCartLine,
}: {
  shop: ShopView
  t: Translate
  sticky: boolean
  searchSuggest?: string | undefined
  changeCartLine?: ((form: FormData) => Promise<void>) | undefined
}) {
  const pictures = shop.headerBar?.menuImages !== "off"
  const menu = menuWords(shop.categories, t)
  const search = searchOf(shop, t, searchSuggest)
  const account = accountOf(shop, t)
  const highlight = shop.headerBar?.highlight ?? null
  // The home page's link is the page's own on "/", as any other link on its path
  const current = shop.path ?? null
  const plain = shop.headerBar?.toolsStyle === "plain"
  const tool = plain ? "gf-icon-btn" : TOOL
  return (
    <header
      data-gf-head=""
      {...sectionMark(shop.headerBar?.id)}
      className={cn("z-(--z-sticky-nav) bg-paper", sticky ? "gf-head sticky top-0" : "relative")}
      data-variant="inline"
      data-tool-words={shop.headerBar?.toolLabels === "hide" ? "hidden" : undefined}
      data-tools={plain ? "plain" : undefined}
      data-over-cover={shop.headerBar?.overCover ? "" : undefined}
    >
      <Container
        data-gf-head-row=""
        className={
          plain
            ? "gf-head-row flex h-14 items-center gap-1 lg:h-18 lg:gap-(--space-lg)"
            : "gf-head-row flex h-14 items-center gap-1 lg:h-24 lg:gap-(--space-lg)"
        }
      >
        <MenuSheet
          categories={shop.categories}
          topLinks={shop.topLinks}
          contact={shop.contact}
          pictures={pictures}
          {...(highlight ? { highlight } : {})}
          words={{
            open: t("nav.open_menu"),
            title: t("nav.menu"),
            close: t("nav.close"),
            whatsapp: t("home.help_whatsapp"),
            ...menu,
          }}
        />
        <Wordmark name={shop.name} logo={shop.logo} large={!plain} className="mr-auto lg:mr-0" />
        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          {shop.categories.length > 0 && (
            <Aisle
              categories={shop.categories}
              label={t("nav.categories")}
              words={menu}
              centered
              inRow
              current={current}
              pictures={pictures}
              mega={shop.headerBar?.submenuStyle === "mega"}
            />
          )}
        </div>
        {shop.editor && <SearchDropOpener label={t("search.open")} className={tool} />}
        <nav aria-label={t("nav.account")} className="flex items-center gap-1 lg:gap-2">
          <SearchToggle
            {...search}
            id="arama-genis"
            align="end"
            openLabel={t("search.open")}
            className="max-lg:hidden [--gf-search-open:32rem]"
          />
          <a
            href="/hesap/favoriler"
            aria-label={t("nav.favorites")}
            className={plain ? cn(tool, "lg:hidden") : TOOL}
          >
            <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
          </a>
          <CartSheet
            cart={shop.cart}
            count={shop.cartQuantity}
            categories={shop.categories}
            change={changeCartLine}
            buttonClass={tool}
            words={cartSheetWords(t, shop.cartQuantity)}
          />
          <a href="/hesap" aria-label={account} className={cn(tool, "max-lg:hidden")}>
            <UserRound className="size-6" aria-hidden="true" strokeWidth={1.75} />
          </a>
        </nav>
        {plain && highlight && (
          <a
            href={highlight.path}
            className="gf-btn gf-btn--small shrink-0 max-lg:hidden"
            {...fieldMark(shop.editor, "highlight_link")}
          >
            {highlight.label}
            <ArrowRight className="size-4" aria-hidden="true" strokeWidth={2} />
          </a>
        )}
      </Container>
      <SearchDrop {...search} title={t("search.title")} closeLabel={t("search.close")} />
    </header>
  )
}
