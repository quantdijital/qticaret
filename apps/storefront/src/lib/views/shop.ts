import "server-only"
import type { ContactView, ShopView, Translate } from "@qticaret/ui"
import type { LegalIdentity } from "@qticaret/types"
import { currentCustomer } from "@/lib/account/auth"
import { headerCart } from "@/lib/cart/cart"
import { bannerDue, cookieConsent } from "@/lib/legal/cookies"
import { t } from "@/lib/i18n"
import {
  allCategories,
  legalIdentity,
  pathsOf,
  siteSeo,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { miniCartOf } from "./cart"
import { navigation } from "./categories"
import { identityLinesOf, legalDocument, legalPath, publishedLegalLinks } from "./legal"
import { displayPhone, footerGroups, linkViews, socialLinks, whatsappHref } from "./frame"
import { hoursOf } from "./hours"

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

/** The frame around every page (D3, docs/19 §4), from the backend's answers. */
export async function shopView(): Promise<ShopView> {
  const [
    site,
    categories,
    { storefront: frame, free_shipping_threshold },
    identity,
    cart,
    cookies,
    customer,
    cookiePolicy,
    legalLinks,
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
  ])
  const paths = await pathsOf(
    "product_category",
    categories.map((category) => category.id)
  )
  // The shop's own menu when it wrote one, else its top categories
  const menu =
    frame.menu.length > 0
      ? frame.menu.map((item) => ({
          label: item.label,
          path: item.href,
          children: linkViews(item.children),
        }))
      : navigation(categories, paths)
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
    cart: miniCartOf(cart, free_shipping_threshold, t),
    announcements: frame.announcements,
    topLinks: linkViews(frame.top_links),
    footerGroups: footerGroups(frame, menu, t),
    trustBadges: frame.trust_badges,
    contact: contactOf(identity, t),
    social: socialLinks(identity.same_as),
    companyTitle: identity.company_title,
    cookieBanner: bannerDue(cookies)
      ? {
          policyVersion: cookies?.policy_version ?? null,
          policyPath: cookiePolicy ? legalPath("cookie_policy") : null,
        }
      : null,
    customerName: customer ? (customer.first_name ?? customer.email) : null,
    legalLinks,
    privacyPath: legalLinks.some((link) => link.path === legalPath("privacy_notice"))
      ? legalPath("privacy_notice")
      : null,
    identityLines: identityLinesOf(identity, t),
  }
}
