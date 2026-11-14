import "server-only"
import { headers } from "next/headers"
import type { ContactView, ShopView, Translate } from "@qticaret/ui"
import type { LegalIdentity, StoreLayout } from "@qticaret/types"
import { currentCustomer } from "@/lib/account/auth"
import { headerCart } from "@/lib/cart/cart"
import { cookieConsent, onCookiePreferencesPage } from "@/lib/legal/cookies"
import { t } from "@/lib/i18n"
import {
  allCategories,
  legalIdentity,
  pathsOf,
  siteSeo,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { categoryImages } from "@/lib/store-api/extras"
import { bottomNavOf, isCheckoutPage } from "./bottom-nav"
import { shopMarks } from "./card-extras"
import { miniCartOf } from "./cart"
import { linePicturesOf, productPathsOf } from "./line-paths"
import { imageView } from "./image"
import { navigation } from "./categories"
import { withNavPictures } from "./nav-pictures"
import { cookieBannerOf } from "./cookies"
import { identityLinesOf, legalDocument, legalPath, publishedLegalLinks } from "./legal"
import { displayPhone, footerGroups, socialLinks, whatsappHref } from "./frame"
import { currentLayout, currentMenus } from "./layout"
import { sharedSettingsOf } from "./shared-settings"
import { footerMenus, mainMenu, topLinks } from "./menus"
import { hoursOf } from "./hours"
import { themeView } from "./theme"
import { currentTheme } from "./theme-settings"
import { headerMarquee } from "./marquee"

/** How to reach the shop, from its store details and legal identity (adr/0048): one source. */
export function contactOf(identity: LegalIdentity, t: Translate): ContactView {
  return {
    email: identity.email,
    phone: identity.phone ? displayPhone(identity.phone) : null,
    phoneHref: identity.phone ? `tel:${identity.phone}` : null,
    whatsappHref: identity.whatsapp ? whatsappHref(identity.whatsapp) : null,
    address: identity.address,
    hours: hoursOf(identity.opening_hours, t),
    mapHref: identity.map_url,
  }
}

/** The footer's newsletter box in the design's words; null when the shop took it out. */
function newsletterOf(layout: StoreLayout, shop: string): ShopView["newsletter"] {
  const [section] = layout.footer
  return section
    ? {
        title: section.title ?? t("newsletter.title"),
        text: section.text ?? t("newsletter.text", { shop }),
      }
    : null
}

/** The frame around every page (D3, docs/19 §4), from the backend's answers. */
export async function shopView(): Promise<ShopView> {
  const [
    site,
    categories,
    { storefront: frame, free_shipping_threshold, marks },
    identity,
    cart,
    cookies,
    customer,
    cookiePolicy,
    legalLinks,
    menus,
    layout,
    preferencesPage,
    theme,
    requestHeaders,
    pictures,
  ] = await Promise.all([
    siteSeo(),
    allCategories(),
    storefrontSettings(),
    legalIdentity(),
    headerCart(),
    cookieConsent(),
    currentCustomer(),
    legalDocument("cookie_policy"),
    publishedLegalLinks(),
    currentMenus(),
    currentLayout(),
    onCookiePreferencesPage(),
    currentTheme(),
    headers(),
    categoryImages(),
  ])
  // The drawer's lines link to their products' pages (gone or hidden ones read as text)
  const [paths, linePaths, linePictures] = await Promise.all([
    pathsOf(
      "product_category",
      categories.map((category) => category.id)
    ),
    productPathsOf(cart?.items ?? []),
    linePicturesOf(cart?.items ?? []),
  ])
  // The shop's own menu when it made one (adr/0049), else its top categories; pictures on both
  // Each top entry without the shop's own picture shows its newest product's photo
  const menu = await withNavPictures(
    mainMenu(menus, t, pictures) ?? navigation(categories, paths, pictures),
    categories,
    paths
  )
  // The page's address as the proxy set it (never the visitor's)
  const url = requestHeaders.get("x-qt-url") ?? ""
  return {
    name: site.shop.name,
    logo: site.shop.logo_url
      ? {
          src: site.shop.logo_url,
          alt: site.shop.name,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
    categories: menu,
    cartQuantity: (cart?.items ?? []).reduce((sum, line) => sum + line.quantity, 0),
    cart: miniCartOf(cart, free_shipping_threshold, t, linePaths, linePictures),
    // The header's and footer's sections from the design (adr/0049)
    announcements: layout.header.flatMap((section) =>
      section.type === "announcement_bar" ? section.lines : []
    ),
    marquee: headerMarquee(layout.header, t),
    newsletter: newsletterOf(layout, identity.company_title ?? site.shop.name),
    topLinks: topLinks(menus, t),
    footerGroups: footerGroups(footerMenus(menus, t), menu, t),
    // The design's badges (adr/0049 Ek 2026-11-06); a preview shows its draft's
    trustBadges: sharedSettingsOf(layout, frame).trust_badges,
    contact: contactOf(identity, t),
    social: socialLinks(identity.same_as),
    companyTitle: identity.company_title,
    cookieBanner: cookieBannerOf(
      cookies,
      cookiePolicy ? legalPath("cookie_policy") : null,
      preferencesPage
    ),
    customerName: customer ? (customer.first_name ?? customer.email) : null,
    legalLinks,
    privacyPath: legalLinks.some((link) => link.path === legalPath("privacy_notice"))
      ? legalPath("privacy_notice")
      : null,
    identityLines: identityLinesOf(identity, t),
    theme: themeView(theme),
    bottomNav: bottomNavOf(url),
    checkout: isCheckoutPage(url),
    // The footer's identity slot and marks (adr/0046 Ek 2026-11-04)
    etbisQr: identity.etbis_qr ? imageView(identity.etbis_qr, t("footer.etbis_qr_alt")) : null,
    paymentMarks: shopMarks(marks?.payments, t),
    carrierMarks: shopMarks(marks?.carriers, t),
  }
}
