import { House, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { BottomNavItem, BottomNavView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { MenuLink } from "./MenuLink"
import { SearchLink } from "./SearchLink"

export interface BottomBarWords {
  label: string
  home: string
  categories: string
  search: string
  cart: string
  /** "Sepet, 2 ürün": the cart item's name with its count. */
  cartLabel: string
  account: string
}

const ITEM =
  "relative mx-auto flex h-14 w-full max-w-20 flex-col items-center justify-center gap-1 rounded-media text-2xs leading-none font-semibold"

/**
 * The phone's bottom bar under 1024 px: 64 px and the safe area, on the
 * counter's colour, five items with 12 px names; the page's own item sits
 * on a tinted pill in the ink, `aria-current`. Its height is held at the
 * page's foot from the first paint, so nothing moves and the footer's
 * last line stays clear. "Kategoriler" opens the menu sheet and "Ara"
 * the header's search field where the visitor is, or drops it from the
 * top when the header draws its search as an icon (links without script).
 */
export function BottomBar({
  nav,
  cartCount,
  words,
}: {
  nav: BottomNavView
  cartCount: number
  words: BottomBarWords
}) {
  const style = (item: BottomNavItem) =>
    cn(ITEM, nav.current === item ? "bg-paper-2 text-text" : "text-text-3")
  const current = (item: BottomNavItem) => (nav.current === item ? "page" : undefined)
  const icon = (Icon: LucideIcon) => (
    <Icon className="size-6" aria-hidden="true" strokeWidth={1.75} />
  )
  return (
    <div className="lg:hidden" data-bottom-nav="">
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label={words.label}
        className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-paper px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          <li>
            <a href="/" aria-current={current("home")} className={style("home")}>
              {icon(House)}
              {words.home}
            </a>
          </li>
          <li>
            <MenuLink current={nav.current === "categories"} className={style("categories")}>
              {icon(LayoutGrid)}
              {words.categories}
            </MenuLink>
          </li>
          <li>
            <SearchLink current={nav.current === "search"} className={style("search")}>
              {icon(Search)}
              {words.search}
            </SearchLink>
          </li>
          <li>
            <a
              href="/sepet"
              aria-current={current("cart")}
              aria-label={words.cartLabel}
              className={style("cart")}
            >
              <span className="relative">
                {icon(ShoppingBag)}
                {cartCount > 0 && (
                  <span aria-hidden="true" className="gf-count tabular -top-1.5 -right-3">
                    {cartCount}
                  </span>
                )}
              </span>
              {words.cart}
            </a>
          </li>
          <li>
            <a href="/hesap" aria-current={current("account")} className={style("account")}>
              {icon(UserRound)}
              {words.account}
            </a>
          </li>
        </ul>
      </nav>
    </div>
  )
}
