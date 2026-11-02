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
  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium transition-colors"

/**
 * The phone's bottom bar (under 1024 px; docs/20 "mobil alt gezinme"): the
 * home page, the categories (the menu drawer, `/kategoriler` without
 * script), search, the cart with its count and the account, the page's
 * own item marked. Its height is held at the foot of the page from the
 * first paint, so nothing moves and the footer's last line stays clear;
 * the phone's home indicator gets its own room below.
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
        ? "text-foreground before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-foreground"
        : "text-muted-foreground hover:text-foreground"
    )
  const current = (item: BottomNavItem) => (nav.current === item ? "page" : undefined)
  const icon = (Icon: LucideIcon) => <Icon className="size-5" aria-hidden="true" />
  return (
    <div className="lg:hidden" data-bottom-nav="">
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label={words.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
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
                    className="tabular absolute -top-1.5 -right-2.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-highlight px-1 text-[10px] leading-[1.125rem] font-semibold text-highlight-foreground ring-2 ring-background"
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
