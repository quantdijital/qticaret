import { House, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { BottomNavItem, BottomNavView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { BottomNavMenuLink } from "./BottomNavMenuLink"

export interface BottomNavWords {
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
  "at-bar-item relative flex h-14 flex-col items-center justify-center gap-1 text-2xs leading-none"

/**
 * The phone's bottom bar under 1024 px (design.md § Bottom nav): 56 px and
 * the phone's safe area, flat paper under a hairline, five items with
 * 12 px labels; the page's own item has a 2 px ink rule on top, the
 * medium weight and `aria-current`. Its height is held at the page's foot
 * from the first paint, so nothing moves and the footer's last line stays
 * clear.
 */
export function BottomNav({
  nav,
  cartCount,
  words,
}: {
  nav: BottomNavView
  cartCount: number
  words: BottomNavWords
}) {
  const style = (item: BottomNavItem) =>
    cn(
      ITEM,
      nav.current === item
        ? "font-medium text-text before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-rule-ink"
        : "text-text-2"
    )
  const current = (item: BottomNavItem) => (nav.current === item ? "page" : undefined)
  const icon = (Icon: LucideIcon) => (
    <Icon className="size-6" aria-hidden="true" strokeWidth={1.5} />
  )
  return (
    <div className="lg:hidden" data-bottom-nav="">
      <div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label={words.label}
        className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          <li>
            <a href="/" aria-current={current("home")} className={style("home")}>
              {icon(House)}
              {words.home}
            </a>
          </li>
          <li>
            <BottomNavMenuLink
              current={nav.current === "categories"}
              className={style("categories")}
            >
              {icon(LayoutGrid)}
              {words.categories}
            </BottomNavMenuLink>
          </li>
          <li>
            <a href="/arama" aria-current={current("search")} className={style("search")}>
              {icon(Search)}
              {words.search}
            </a>
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
                  <span
                    aria-hidden="true"
                    className="tabular absolute -top-1.5 -right-3 min-w-5 bg-signal px-1 text-center text-xs leading-5 font-medium text-signal-ink"
                  >
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
