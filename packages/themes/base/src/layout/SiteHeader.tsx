import { ShoppingBag } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { CategoryNav } from "./CategoryNav"
import { MobileMenu } from "./MobileMenu"
import { SearchForm } from "./SearchForm"

/**
 * The header: the shop's small links (wide screens), the logo, search and
 * cart, and the category menu (a drawer on phones). Sticky, so search and
 * cart stay at hand on a long page.
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
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {(shop.topLinks.length > 0 || shop.contact.phone) && (
        <div className="hidden border-b lg:block">
          <Container className="flex h-9 items-center justify-end gap-6 text-xs text-muted-foreground">
            {shop.topLinks.length > 0 && (
              <nav aria-label={t("nav.top_links")}>
                <ul className="flex gap-5">
                  {shop.topLinks.map((link) => (
                    <li key={link.path}>
                      <a href={link.path} className="hover:text-foreground">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {shop.contact.phone && shop.contact.phoneHref && (
              <a href={shop.contact.phoneHref} className="font-medium hover:text-foreground">
                {shop.contact.phone}
              </a>
            )}
          </Container>
        </div>
      )}
      <Container className="flex h-16 items-center gap-3 lg:gap-8">
        <MobileMenu
          categories={shop.categories}
          topLinks={shop.topLinks}
          words={{ open: t("nav.open_menu"), title: t("nav.menu"), close: t("nav.close"), allIn }}
        />
        <a href="/" className="flex shrink-0 items-center text-xl font-semibold tracking-tight">
          {shop.logo ? (
            <ResponsiveImage image={shop.logo} sizes="160px" priority className="h-9 w-auto" />
          ) : (
            shop.name
          )}
        </a>
        <SearchForm {...search} id="arama-genis" className="hidden flex-1 md:block lg:max-w-xl" />
        <a
          href="/sepet"
          aria-label={t("nav.cart_label", { count: shop.cartQuantity })}
          className="relative ml-auto flex size-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          {shop.cartQuantity > 0 && (
            <span
              aria-hidden="true"
              className="tabular absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-5 text-primary-foreground"
            >
              {shop.cartQuantity}
            </span>
          )}
        </a>
      </Container>
      <Container className="pb-3 md:hidden">
        <SearchForm {...search} id="arama-dar" />
      </Container>
      {shop.categories.length > 0 && (
        <div className="hidden border-t lg:block">
          <Container className="py-1">
            <CategoryNav categories={shop.categories} label={t("nav.categories")} allIn={allIn} />
          </Container>
        </div>
      )}
    </header>
  )
}
