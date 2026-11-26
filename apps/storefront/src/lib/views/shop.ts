import "server-only"
import { announcementSettingsOf } from "@qticaret/types/section-announcement"
import { headers } from "next/headers"
import type { ContactView, ShopView, Translate } from "@qticaret/ui"
import type { LegalIdentity, StoreLayout } from "@qticaret/types"
import { currentCustomer } from "@/lib/account/auth"
import { RETAIL, currentWholesale } from "@/lib/account/wholesale"
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
import { categoryCounts, categoryImages } from "@/lib/store-api/extras"
import { bottomNavOf, isCheckoutPage, pathOf } from "./bottom-nav"
import { shopMarks } from "./card-extras"
import { newsletterLookOf } from "./newsletter"
import { miniCartOf } from "./cart"
import { drawerSuggestions, withSuggestions } from "./cart-cross-sells"
import { wholesaleCheckoutBlocked } from "./cart-wholesale"
import { freeShippingProductsOf, linePicturesOf, productPathsOf } from "./line-paths"
import { imageView } from "./image"
import { navigation, withPicturesOf } from "./categories"
import { withNavPictures } from "./nav-pictures"
import { withNavCounts } from "./nav-counts"
import { cookieBannerOf } from "./cookies"
import { identityLinesOf, legalDocument, legalPath, publishedLegalLinks } from "./legal"
import { displayPhone, footerGroups, socialLinks, whatsappHref } from "./frame"
import { currentLayout, currentMenus, isEditorSession } from "./layout"
import { sharedSettingsOf } from "./shared-settings"
import { footerMenus, mainMenu, topLinks } from "./menus"
import { hoursOf } from "./hours"
import { themeView } from "./theme"
import { currentTheme } from "./theme-settings"
import { footerLogosOf } from "./footer-logo"
import { footerNewsletterOf, footerSectionsOf, joinedBand } from "./footer-group"
import { footerBarOf, headerBarOf } from "./main-sections"
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
function newsletterOf(layout: StoreLayout, shop: string, editing: boolean): ShopView["newsletter"] {
  const section = footerNewsletterOf(layout)
  return section
    ? {
        title: section.title ?? t("newsletter.title"),
        text: section.text ?? t("newsletter.text", { shop }),
        // How it is drawn in the footer (adr/0049 Ek 2026-11-17 e-bülten)
        ...newsletterLookOf(section, t, "footer"),
        // Its band on the free rows footer's ground (adr/0070 §4 Ek)
        ...(joinedBand(section) ? { joined: true } : {}),
        // The editor's live session marks the box as its own section (adr/0065 Faz 2b)
        ...(editing ? { mark: section.id } : {}),
      }
    : null
}

/** The frame around every page (D3, docs/19 §4), from the backend's answers. */
export async function shopView(): Promise<ShopView> {
  const [
    site,
    categories,
    { storefront: frame, free_shipping_threshold, marks, features },
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
    counts,
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
    categoryCounts(),
  ])
  // The drawer's lines link to their products' pages (gone or hidden ones read as text)
  // A wholesaler's drawer is without KDV (ADR-0068 §5); asked only with lines to show
  const [paths, linePaths, linePictures, wholesale, freeProducts, suggestions] = await Promise.all([
    pathsOf(
      "product_category",
      categories.map((category) => category.id)
    ),
    productPathsOf(cart?.items ?? []),
    linePicturesOf(cart?.items ?? []),
    customer && (cart?.items.length ?? 0) > 0 ? currentWholesale() : RETAIL,
    // adr/0087 §3: a cart of free-shipping products says so instead of the meter
    freeShippingProductsOf(cart?.items ?? []),
    // S3: what the cart's products are bought with, under the drawer's lines
    drawerSuggestions(cart, t),
  ])
  // The shop's own menu when it made one (adr/0049), else its top categories; pictures on both
  // Each top entry without the shop's own picture shows its newest product's photo;
  // each category's page its product count (the dropdown's and the sheet's badges)
  const menu = withNavCounts(
    await withNavPictures(
      mainMenu(menus, t, pictures) ?? navigation(categories, paths, pictures),
      categories,
      paths
    ),
    paths,
    counts
  )
  // The page's address as the proxy set it (never the visitor's)
  const url = requestHeaders.get("x-qt-url") ?? ""
  // The editor's live session marks the frame's fields: the one announcement bar and its
  // lines, the header strip, the catalog header, the footer's newsletter (adr/0065 Faz 2b)
  // The footer group's sections above the footer (adr/0070 §4): not on the pages of paying
  const [editing, footerSections] = await Promise.all([
    isEditorSession(),
    isCheckoutPage(url) ? Promise.resolve([]) : footerSectionsOf(layout, t),
  ])
  const bars = layout.header.filter((section) => section.type === "announcement_bar")
  const [bar] = bars
  const announcementMark = bars.length === 1 && bar && editing ? bar.id : null
  // The design's badges (adr/0049 Ek 2026-11-06); a preview shows its draft's
  const trustBadges = sharedSettingsOf(layout, frame).trust_badges
  const contact = contactOf(identity, t)
  const social = socialLinks(identity.same_as)
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
    cart: withSuggestions(
      miniCartOf(
        cart,
        free_shipping_threshold,
        t,
        linePaths,
        linePictures,
        wholesale.active && wholesale.vatExclusive,
        // Under a wholesaler's minimum units, "Ödemeye geç" off as on the cart page (ADR-0068 §8)
        wholesaleCheckoutBlocked(cart, wholesale, t),
        freeProducts
      ),
      suggestions
    ),
    // The header's and footer's sections from the design (adr/0049)
    announcements: layout.header.flatMap((section) =>
      section.type === "announcement_bar" ? section.lines : []
    ),
    announcementSettings: announcementSettingsOf(
      layout.header.find((section) => section.type === "announcement_bar") ?? {}
    ),
    ...(announcementMark ? { announcementMark } : {}),
    ...(editing ? { editor: true as const } : {}),
    marquee: headerMarquee(layout.header, t),
    // The design's header bar and footer (Ek 2026-11-14 §5); the theme's header before them
    // The catalog header's "Kategoriler" lists the top categories already read (no request),
    // with the shop's pictures, else the ones the menu shows for the same page
    headerBar: headerBarOf(layout.main, theme, {
      t,
      tree: () => withPicturesOf(navigation(categories, paths, pictures), menu),
    }),
    // The free rows footer's blocks take the details read here (adr/0070: no request of their own)
    footerBar: footerBarOf(layout.main, t, footerLogosOf(site.shop, theme.colors.primary), {
      menus,
      contact,
      social,
      name: site.shop.name,
      title: identity.company_title ?? site.shop.name,
      trustBadges,
      payments: shopMarks(marks?.payments, t),
      carriers: shopMarks(marks?.carriers, t),
    }),
    newsletter: newsletterOf(layout, identity.company_title ?? site.shop.name, editing),
    ...(footerSections.length > 0 ? { footerSections } : {}),
    topLinks: topLinks(menus, t),
    footerGroups: footerGroups(footerMenus(menus, t), menu, t),
    trustBadges,
    contact,
    social,
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
    path: pathOf(url),
    checkout: isCheckoutPage(url),
    // The footer's identity slot and marks (adr/0046 Ek 2026-11-04)
    etbisQr: identity.etbis_qr ? imageView(identity.etbis_qr, t("footer.etbis_qr_alt")) : null,
    paymentMarks: shopMarks(marks?.payments, t),
    carrierMarks: shopMarks(marks?.carriers, t),
    // The header search's hint while sentences are read (adr/0077 §7)
    ...(features?.natural_search === true ? { searchHint: t("search.natural_hint") } : {}),
  }
}
