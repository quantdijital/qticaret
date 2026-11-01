import "server-only"
import type { ShopView } from "@qticaret/ui"
import { cartQuantity } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import {
  allCategories,
  legalIdentity,
  pathsOf,
  siteSeo,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { navigation } from "./categories"
import { displayPhone, footerGroups, linkViews, socialLinks, whatsappHref } from "./frame"

/** The frame around every page (D3, docs/19 §4), from the backend's answers. */
export async function shopView(): Promise<ShopView> {
  const [site, categories, { storefront: frame }, identity, quantity] = await Promise.all([
    siteSeo(),
    allCategories(),
    storefrontSettings(),
    legalIdentity(),
    cartQuantity(),
  ])
  const paths = await pathsOf(
    "product_category",
    categories.map((category) => category.id)
  )
  const menu = navigation(categories, paths)
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
    cartQuantity: quantity,
    announcements: frame.announcements,
    topLinks: linkViews(frame.top_links),
    footerGroups: footerGroups(frame, menu, t),
    trustBadges: frame.trust_badges,
    contact: {
      email: identity.email,
      phone: identity.phone ? displayPhone(identity.phone) : null,
      phoneHref: identity.phone ? `tel:${identity.phone}` : null,
      whatsappHref: frame.whatsapp_phone ? whatsappHref(frame.whatsapp_phone) : null,
      address: identity.address,
    },
    social: socialLinks(identity.same_as),
    companyTitle: identity.company_title,
  }
}
