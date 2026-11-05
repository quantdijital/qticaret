import type { ReactNode } from "react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Announcement } from "./frame/Announcement"
import { BottomBar } from "./frame/BottomBar"
import { Consent } from "./frame/Consent"
import { Footer } from "./frame/Footer"
import { Header } from "./frame/Header"
import { WhatsApp } from "./frame/WhatsApp"

/**
 * The frame every page shares (docs/tema/yon-2026-11-05.md § Frame): a
 * skip link, the graphite announcement bar, the sticky two-row header,
 * the page, the graphite mast footer, and under 1024 px the bottom bar.
 * The WhatsApp button stays away from the checkout and the cart, and
 * while the cookie question waits. Each page sets its own width.
 */
export function Layout({
  shop,
  t,
  children,
  saveCookies,
  subscribe,
  searchSuggest,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
  saveCookies: (form: FormData) => Promise<void>
  subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  searchSuggest?: string
}) {
  const whatsapp =
    shop.contact.whatsappHref !== null &&
    shop.bottomNav !== null &&
    shop.bottomNav.current !== "cart" &&
    shop.cookieBanner?.due !== true
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#icerik" className="gf-skip">
        {t("nav.skip_to_content")}
      </a>
      <Announcement
        lines={shop.announcements}
        links={shop.topLinks}
        contact={shop.contact}
        words={{ announcements: t("nav.announcements"), links: t("nav.top_links") }}
      />
      <Header shop={shop} t={t} searchSuggest={searchSuggest} />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <Footer shop={shop} t={t} subscribe={subscribe} />
      {shop.bottomNav && (
        <BottomBar
          nav={shop.bottomNav}
          cartCount={shop.cartQuantity}
          words={{
            label: t("nav.bottom.label"),
            home: t("nav.bottom.home"),
            categories: t("nav.bottom.categories"),
            search: t("nav.bottom.search"),
            cart: t("nav.bottom.cart"),
            cartLabel: t("nav.bottom.cart_label", { count: shop.cartQuantity }),
            account: t("nav.bottom.account"),
          }}
        />
      )}
      {whatsapp && shop.contact.whatsappHref && (
        <WhatsApp
          href={shop.contact.whatsappHref}
          label={t("whatsapp.label")}
          aboveBottomBar={shop.bottomNav !== null}
        />
      )}
      {shop.cookieBanner && <Consent banner={shop.cookieBanner} save={saveCookies} t={t} />}
    </div>
  )
}
