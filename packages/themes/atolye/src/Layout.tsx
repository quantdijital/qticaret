import type { ReactNode } from "react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { AnnouncementBar } from "./layout/AnnouncementBar"
import { BottomNav } from "./layout/BottomNav"
import { CookieBanner } from "./layout/CookieBanner"
import { SiteFooter } from "./layout/SiteFooter"
import { SiteHeader } from "./layout/SiteHeader"
import { WhatsAppButton } from "./layout/WhatsAppButton"

/**
 * The frame every page shares (design.md § Components): a skip link, the
 * announcement band (not sticky; not drawn without lines on a phone), the
 * search-first header, the page, the mast footer, and under 1024 px the
 * bottom bar. The WhatsApp button stays away from the checkout and the
 * cart, where it covered fields and totals (denetim §0.8), and while the
 * cookie question waits. Each page sets its own width (`Container`).
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
  // No bottom bar: the checkout, a preview or the maintenance link's page
  const whatsapp =
    shop.contact.whatsappHref !== null &&
    shop.bottomNav !== null &&
    shop.bottomNav.current !== "cart" &&
    shop.cookieBanner?.due !== true
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#icerik" className="at-skip">
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
      {whatsapp && shop.contact.whatsappHref && (
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
