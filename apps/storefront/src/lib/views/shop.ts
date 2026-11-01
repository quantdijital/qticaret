import "server-only"
import type { ContactView, ShopView } from "@qticaret/ui"
import type { LegalIdentity, StorefrontFrame } from "@qticaret/types"
import { headerCart } from "@/lib/cart/cart"
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
import { displayPhone, footerGroups, linkViews, socialLinks, whatsappHref } from "./frame"

/** How to reach the shop: the legal identity's contact details, the frame's WhatsApp number. */
export function contactOf(identity: LegalIdentity, frame: StorefrontFrame): ContactView {
  return {
    email: identity.email,
    phone: identity.phone ? displayPhone(identity.phone) : null,
    phoneHref: identity.phone ? `tel:${identity.phone}` : null,
    whatsappHref: frame.whatsapp_phone ? whatsappHref(frame.whatsapp_phone) : null,
    address: identity.address,
  }
}

/** The frame around every page (D3, docs/19 §4), from the backend's answers. */
export async function shopView(): Promise<ShopView> {
  const [site, categories, { storefront: frame, free_shipping_threshold }, identity, cart] =
    await Promise.all([
      siteSeo(),
      allCategories(),
      storefrontSettings(),
      legalIdentity(),
      headerCart(),
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
    contact: contactOf(identity, frame),
    social: socialLinks(identity.same_as),
    companyTitle: identity.company_title,
  }
}
