import type { ReactNode } from "react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { AnnouncementBar } from "./layout/AnnouncementBar"
import { BottomNav } from "./layout/BottomNav"
import { CookieBanner } from "./layout/CookieBanner"
import { SiteFooter } from "./layout/SiteFooter"
import { SiteHeader } from "./layout/SiteHeader"
import { WhatsAppButton } from "./layout/WhatsAppButton"

/**
 * The frame every page shares (D3, docs/19 §4): a skip link, the
 * announcement bar, the header with search, cart and categories, the
 * page, the footer, the WhatsApp button when the shop gave a number, and
 * on phones the bottom bar (not on the checkout nor in a preview).
 * Each page sets its own width (`Container`), so a band can run edge to edge.
 */
export function Layout({
  shop,
  t,
  children,
  saveCookies,
  subscribe,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
  saveCookies: (form: FormData) => Promise<void>
  subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("nav.skip_to_content")}
      </a>
      <AnnouncementBar
        lines={shop.announcements}
        links={shop.topLinks}
        contact={shop.contact}
        words={{ announcements: t("nav.announcements"), links: t("nav.top_links") }}
      />
      <SiteHeader shop={shop} t={t} />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter shop={shop} t={t} subscribe={subscribe} />
      {shop.bottomNav && (
        <BottomNav
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
      {shop.contact.whatsappHref && !shop.cookieBanner?.due && (
        <WhatsAppButton
          href={shop.contact.whatsappHref}
          label={t("whatsapp.label")}
          aboveBottomNav={shop.bottomNav !== null}
        />
      )}
      {shop.cookieBanner && <CookieBanner banner={shop.cookieBanner} save={saveCookies} t={t} />}
    </div>
  )
}
