import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"

/**
 * The frame every page shares: a skip link, the shop's name or logo, the
 * category menu (a plain disclosure on phones: no script needed), the cart
 * and the footer's legal pages.
 */
export function Layout({
  shop,
  t,
  children,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        {t("nav.skip_to_content")}
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="/" className="flex shrink-0 items-center text-lg font-semibold">
            {shop.logo ? (
              <ResponsiveImage image={shop.logo} sizes="160px" priority className="h-8 w-auto" />
            ) : (
              shop.name
            )}
          </a>
          <nav aria-label={t("nav.categories")} className="hidden flex-1 md:block">
            <ul className="flex flex-wrap gap-5 text-sm">
              {shop.categories.map((category) => (
                <li key={category.path}>
                  <a href={category.path} className="hover:underline">
                    {category.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a
            href="/sepet"
            className="ml-auto rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t("nav.cart", { count: shop.cartQuantity })}
          </a>
        </div>
        {shop.categories.length > 0 && (
          <details className="border-t border-border px-4 py-2 md:hidden">
            <summary className="cursor-pointer text-sm font-medium">{t("nav.categories")}</summary>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {shop.categories.map((category) => (
                <li key={category.path}>
                  <a href={category.path}>{category.label}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </header>
      <main id="icerik" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>{shop.name}</p>
          {shop.legal.length > 0 && (
            <nav aria-label={t("nav.legal")}>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {shop.legal.map((link) => (
                  <li key={link.path}>
                    <a href={link.path} className="hover:text-foreground">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </footer>
    </div>
  )
}
