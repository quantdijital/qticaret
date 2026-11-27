import type { ReactNode } from "react"
import type {
  PlaceOrderResult,
  PopupSetup,
  QuickViewSetup,
  ShopView,
  Translate,
} from "@qticaret/ui"
import { BackToTop } from "./frame/BackToTop"
import { BottomBar } from "./frame/BottomBar"
import { CheckoutFooter, CheckoutHeader } from "./frame/CheckoutFrame"
import { Consent } from "./frame/Consent"
import { Footer } from "./frame/Footer"
import { FooterGroup } from "./frame/FooterGroup"
import { Header } from "./frame/Header"
import { topStripOf } from "./frame/TopStrip"
import { CardCycle } from "./frame/CardCycle"
import { ImageCue } from "./frame/ImageCue"
import { LayerMarks } from "./frame/Layers"
import { layerMarks, rootMarks } from "./frame/root-marks"
import { Marquee } from "./sections/Marquee"
import { PointerCue } from "./frame/PointerCue"
import { PopupHost } from "./frame/PopupHost"
import { popupWords } from "./frame/popup-words"
import { QuickViewHost } from "./frame/QuickViewHost"
import { quickViewWords } from "./frame/quick-view-words"
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
 * which way the page scrolls (the header folds, WhatsApp steps aside);
 * `ImageCue` which images are decoded (a card's second photo fades in);
 * `CardCycle` a card's photos in turn under a resting mouse.
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
  quickView,
  popups,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
  saveCookies: (form: FormData) => Promise<void>
  subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  searchSuggest?: string
  changeCartLine?: (form: FormData) => Promise<void>
  quickView?: QuickViewSetup
  popups?: PopupSetup
}) {
  const skip = (
    <a href="#icerik" className="gf-skip">
      {t("nav.skip_to_content")}
    </a>
  )
  // The box style and the style kit's steps off the default (adr/0067): no kit mark at
  // today's drawing. The page's dialogs and drawers get them on their own host (`Layers`).
  const marks = rootMarks(shop.theme)
  const layers = layerMarks(shop.theme)
  const consent = shop.cookieBanner && (
    <Consent banner={shop.cookieBanner} save={saveCookies} t={t} />
  )
  if (shop.checkout) {
    return (
      <div className="flex min-h-dvh flex-col" {...marks}>
        <LayerMarks marks={layers}>
          {skip}
          <CheckoutHeader shop={shop} t={t} />
          <main id="icerik" className="flex-1">
            {children}
          </main>
          <CheckoutFooter shop={shop} t={t} />
          {consent}
        </LayerMarks>
      </div>
    )
  }
  // The shop's top strip, its own section whatever the header (owner 2026-11-27)
  const strip = topStripOf(shop, t)
  const whatsapp =
    shop.contact.whatsappHref !== null &&
    shop.bottomNav !== null &&
    shop.bottomNav.current !== "cart" &&
    shop.cookieBanner?.due !== true
  // The footer's floating "Yukarı çık" (adr/0049 Ek 2026-11-15), away while the cookie question waits
  const backToTop = shop.cookieBanner?.due === true ? null : (shop.footerBar?.backToTop ?? null)
  return (
    <div className="flex min-h-dvh flex-col" {...marks}>
      <LayerMarks marks={layers}>
        {skip}
        {strip.above}
        {shop.marquee && (
          <Marquee
            section={shop.marquee}
            t={t}
            header
            mark={shop.editor ? shop.marquee.id : undefined}
          />
        )}
        <Header
          shop={shop}
          t={t}
          searchSuggest={searchSuggest}
          changeCartLine={changeCartLine}
          strip={strip.inHeader}
        />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <FooterGroup shop={shop} t={t} subscribe={subscribe} />
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
        {backToTop && (
          <BackToTop
            view={backToTop}
            label={t("footer.back_to_top")}
            aboveBottomBar={shop.bottomNav !== null}
            overWhatsApp={whatsapp && backToTop.side === "right"}
          />
        )}
        {/* The cards' quick view (adr/0049 Ek 2026-11-15): its dialog's code only on the first look */}
        {quickView && <QuickViewHost setup={quickView} words={quickViewWords(t)} />}
        {/* The shop's pop-ups (adr/0080 §6): nothing drawn or loaded until one is due */}
        {popups && (
          <PopupHost
            setup={popups}
            member={shop.customerName !== null}
            words={popupWords(
              t,
              shop.newsletter?.text ??
                t("newsletter.text", { shop: shop.companyTitle ?? shop.name })
            )}
            privacyPath={shop.privacyPath}
            subscribe={subscribe}
          />
        )}
        {consent}
        <ScrollCue />
        <ImageCue />
        <CardCycle />
        <PointerCue />
      </LayerMarks>
    </div>
  )
}
