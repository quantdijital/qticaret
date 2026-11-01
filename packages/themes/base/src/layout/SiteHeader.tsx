import { UserRound } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { CartDrawer } from "./CartDrawer"
import { CategoryNav } from "./CategoryNav"
import { MobileMenu } from "./MobileMenu"
import { SearchForm } from "./SearchForm"

const ICON_LINK =
  "relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-foreground/5"

/**
 * The header: the logo in the middle, search on its left and the account
 * and the cart on its right (wide screens), the categories in a row under
 * them; on phones the menu drawer, the logo, the cart and a search field.
 * Sticky, so search and cart stay at hand on a long page.
 */
export function SiteHeader({ shop, t }: { shop: ShopView; t: Translate }) {
  const allIn = Object.fromEntries(
    shop.categories.map((category) => [category.path, t("nav.all_in", { name: category.label })])
  )
  const search = {
    label: t("search.label"),
    placeholder: t("search.placeholder"),
    submit: t("search.submit"),
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <Container className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-20">
        <div className="flex items-center gap-2">
          <MobileMenu
            categories={shop.categories}
            topLinks={shop.topLinks}
            words={{ open: t("nav.open_menu"), title: t("nav.menu"), close: t("nav.close"), allIn }}
          />
          <SearchForm {...search} id="arama-genis" className="hidden w-full max-w-xs lg:block" />
        </div>
        <a
          href="/"
          className="font-heading flex items-center justify-center text-2xl font-medium tracking-tight lg:text-[1.75rem]"
        >
          {shop.logo ? (
            <ResponsiveImage image={shop.logo} sizes="180px" priority className="h-10 w-auto" />
          ) : (
            shop.name
          )}
        </a>
        <div className="flex items-center justify-end gap-1">
          <a
            href="/hesap"
            aria-label={
              shop.customerName
                ? t("nav.account_of", { name: shop.customerName })
                : t("nav.account")
            }
            className={`${ICON_LINK} hidden sm:flex`}
          >
            <UserRound className="size-5" aria-hidden="true" />
            {shop.customerName && (
              <span
                aria-hidden="true"
                className="absolute right-1 bottom-1 size-2.5 rounded-full bg-success ring-2 ring-background"
              />
            )}
          </a>
          <CartDrawer
            cart={shop.cart}
            count={shop.cartQuantity}
            className={ICON_LINK}
            words={{
              label: t("nav.cart_label", { count: shop.cartQuantity }),
              title: t("cart.title"),
              empty: t("cart.empty"),
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
      <Container className="pb-3 lg:hidden">
        <SearchForm {...search} id="arama-dar" />
      </Container>
      {shop.categories.length > 0 && (
        <div className="hidden lg:block">
          <Container className="flex justify-center pb-2">
            <CategoryNav categories={shop.categories} label={t("nav.categories")} allIn={allIn} />
          </Container>
        </div>
      )}
    </header>
  )
}
