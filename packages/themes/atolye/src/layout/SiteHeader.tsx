import { UserRound } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"
import { CartDrawer } from "./CartDrawer"
import { MegaMenu } from "./MegaMenu"
import { MobileMenu } from "./MobileMenu"
import { SearchForm } from "./SearchForm"

/**
 * The header (design.md § Sticky header), search first. A phone: a 56 px
 * row (menu, the shop's name, the cart with its count), the 48 px search
 * row and an ink rule, 106 px in all. From 1024 px: the name on the left,
 * a wide search in the middle, the account and the cart on the right, the
 * category menu under them. Without a logo file the name is a wordmark in
 * the display face (owner, 2026-11-04). Sticky unless the shop says not.
 */
export function SiteHeader({ shop, t }: { shop: ShopView; t: Translate }) {
  const allIn = Object.fromEntries(
    shop.categories.map((category) => [category.path, t("nav.see_all", { name: category.label })])
  )
  const search = {
    label: t("search.label"),
    placeholder: t("search.placeholder"),
    submit: t("search.submit"),
  }
  return (
    <header
      className={cn(
        "z-(--z-sticky-nav) border-b-2 border-rule-ink bg-paper",
        shop.theme.header.sticky ? "sticky top-0" : "relative"
      )}
    >
      <Container className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:h-18 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-(--gap-columns)">
        <div className="flex min-w-0 items-center gap-2">
          <MobileMenu
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
          <a
            href="/"
            aria-label={shop.logo ? shop.name : undefined}
            className="at-wordmark flex min-h-11 min-w-0 items-center"
          >
            {shop.logo ? (
              <ResponsiveImage image={shop.logo} sizes="180px" priority className="h-10 w-auto" />
            ) : (
              <span className="truncate font-display text-wordmark leading-tight tracking-(--tracking-display)">
                {shop.name}
              </span>
            )}
          </a>
        </div>
        <SearchForm {...search} id="arama-genis" className="hidden w-full lg:block" />
        <div className="flex items-center justify-end gap-2">
          <a
            href="/hesap"
            aria-label={
              shop.customerName
                ? t("nav.account_of", { name: shop.customerName })
                : t("nav.account")
            }
            className="at-icon-btn hidden lg:inline-flex"
          >
            <UserRound className="size-6" aria-hidden="true" strokeWidth={1.5} />
          </a>
          <CartDrawer
            cart={shop.cart}
            count={shop.cartQuantity}
            words={{
              label: t("nav.cart_label", { count: shop.cartQuantity }),
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
        </div>
      </Container>
      <Container className="pb-1 lg:hidden">
        <SearchForm {...search} id="arama-dar" />
      </Container>
      {shop.categories.length > 0 && (
        <Container className="hidden lg:block">
          <MegaMenu categories={shop.categories} label={t("nav.categories")} allIn={allIn} />
        </Container>
      )}
    </header>
  )
}
