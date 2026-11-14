import type { ReactNode } from "react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Announcement } from "./frame/Announcement"
import { BottomBar } from "./frame/BottomBar"
import { CheckoutFooter, CheckoutHeader } from "./frame/CheckoutFrame"
import { Consent } from "./frame/Consent"
import { Footer } from "./frame/Footer"
import { Header, catalogOf } from "./frame/Header"
import { Marquee } from "./sections/Marquee"
import { ScrollCue } from "./frame/ScrollCue"
import { WhatsApp } from "./frame/WhatsApp"
import { WhatsAppClear } from "./frame/WhatsAppClear"

/**
 * The frame every page shares (docs/tema/yon-2026-11-05.md § Frame): a
 * skip link, the graphite announcement bar, the shop's scrolling strip
 * when its header group has one (adr/0049 Ek 2026-11-14 §4.1), the sticky two-row header,
 * the page, the graphite mast footer, and under 1024 px the bottom bar.
 * The WhatsApp button stays away from the checkout and the cart, and
 * while the cookie question waits. `ScrollCue` tells the stylesheet
 * which way the page scrolls (the header folds, WhatsApp steps aside).
 * Each page sets its own width. The pages of paying (`shop.checkout`)
 * have a focused frame instead: the checkout's header and the small
 * print, nothing else to leave by (`frame/CheckoutFrame`).
 */
export function Layout({
  shop,
  t,
  children,
  saveCookies,
  subscribe,
  searchSuggest,
  changeCartLine,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
  saveCookies: (form: FormData) => Promise<void>
  subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  searchSuggest?: string
  changeCartLine?: (form: FormData) => Promise<void>
}) {
  const skip = (
    <a href="#icerik" className="gf-skip">
      {t("nav.skip_to_content")}
    </a>
  )
  const consent = shop.cookieBanner && (
    <Consent banner={shop.cookieBanner} save={saveCookies} t={t} />
  )
  if (shop.checkout) {
    return (
      <div className="flex min-h-dvh flex-col">
        {skip}
        <CheckoutHeader shop={shop} t={t} />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <CheckoutFooter shop={shop} t={t} />
        {consent}
      </div>
    )
  }
  // The catalog header draws the top links in its strip and the phone by its search: not twice
  const catalog = catalogOf(shop)
  const whatsapp =
    shop.contact.whatsappHref !== null &&
    shop.bottomNav !== null &&
    shop.bottomNav.current !== "cart" &&
    shop.cookieBanner?.due !== true
  return (
    <div className="flex min-h-dvh flex-col">
      {skip}
      <Announcement
        lines={shop.announcements}
        links={catalog?.strip ? [] : shop.topLinks}
        contact={catalog?.phone ? { ...shop.contact, phone: null, phoneHref: null } : shop.contact}
        words={{ announcements: t("nav.announcements"), links: t("nav.top_links") }}
      />
      {shop.marquee && <Marquee section={shop.marquee} t={t} header />}
      <Header shop={shop} t={t} searchSuggest={searchSuggest} changeCartLine={changeCartLine} />
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
        <>
          <WhatsApp
            href={shop.contact.whatsappHref}
            label={t("whatsapp.label")}
            aboveBottomBar={shop.bottomNav !== null}
          />
          <WhatsAppClear />
        </>
      )}
      {consent}
      <ScrollCue />
    </div>
  )
}
