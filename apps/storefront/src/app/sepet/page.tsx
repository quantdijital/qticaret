import type { Metadata } from "next"
import type { StoreProductAddon } from "@qticaret/types"
import { formatLira } from "@qticaret/ui"
import { themeActions } from "@/lib/theme-actions"
import { ADDON_ERROR_KEYS } from "@/lib/addons/errors"
import { addonsOfProducts } from "@/lib/cart/addons"
import { codesOf, currentCart } from "@/lib/cart/cart"
import { shopperGiftLines } from "@/lib/cart/gift"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { storefrontSettings } from "@/lib/store-api/requests"
import { LINK_CART_LOCKED } from "@/lib/cart/payment-link"
import {
  cartLinesOf,
  differs,
  freeShippingOf,
  lockedNoteOf,
  withAddonForms,
  withGiftLines,
} from "@/lib/views/cart"
import { theme } from "@/theme"

// docs/13 §7: the cart is noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("cart.title"))

const CART_ERRORS = new Set([
  "cart.link_invalid",
  "cart.quantity_invalid",
  "cart.update_failed",
  "errors.too_many_requests",
  // A gift card line's recipient, refused (adr/0025 Ek 2026-11-03)
  "gift_card.recipient_email_invalid",
  "gift_card.text_too_long",
  "gift_card.text_invalid",
  "gift_card.text_link",
  "gift_card.sale_disabled",
  "gift_card.not_gift_line",
  "messaging.email_domain_refuses",
  // A line's add-on picks or its quantity, refused (adr/0052)
  ...ADDON_ERROR_KEYS,
  // A payment link's cart: its lines and code are fixed (adr/0051)
  LINK_CART_LOCKED,
])

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [cart, query, settings] = await Promise.all([
    currentCart(),
    searchParams,
    storefrontSettings(),
  ])
  const error =
    typeof query["hata"] === "string" && CART_ERRORS.has(query["hata"]) ? t(query["hata"]) : null
  // A payment link's cart (adr/0051): its lines as they are, no code, no picks to edit
  const locked = lockedNoteOf(cart, t)
  const [gifts, addons] = await Promise.all([
    shopperGiftLines(cart?.id),
    // Each product's add-ons, for its lines' picks form (none while the shop has them off)
    locked
      ? new Map<string, StoreProductAddon[]>()
      : addonsOfProducts((cart?.items ?? []).flatMap((line) => line.product_id ?? [])),
  ])
  // A gift card line takes no add-ons (its product page offers none)
  const giftLines = new Set(gifts.map((gift) => gift.line_id))
  const lines = withGiftLines(
    withAddonForms(
      cartLinesOf(cart),
      cart ? { ...cart, items: cart.items.filter((line) => !giftLines.has(line.id)) } : null,
      addons,
      t
    ),
    gifts
  )
  // A gift card is bought with money only: no card or credit field while one is in the cart
  const codes = (cart?.gift_cards ?? []).map((card) => card.code)
  const paidByCard = codes.length > 0 || Boolean(cart?.credit_line_total)
  const items = cart?.original_item_total ?? 0
  const subtotal = cart?.item_total ?? 0
  return (
    <theme.CartPage
      t={t}
      actions={themeActions}
      view={{
        lines,
        items: formatLira(items),
        discount: differs(items, subtotal) ? formatLira(items - subtotal) : null,
        subtotal: formatLira(subtotal),
        // A link's code is the link's own, never shown to copy
        promotions: locked ? [] : codesOf(cart),
        giftCards:
          settings.features?.gift_cards && (gifts.length === 0 || codes.length > 0) ? codes : null,
        giftNotice: gifts.length > 0 && paidByCard ? t("gift_card.not_payable_with_credit") : null,
        credit: cart?.credit_line_total ? formatLira(cart.credit_line_total) : null,
        freeShipping: freeShippingOf(subtotal, settings.free_shipping_threshold, t),
        error,
        locked,
      }}
    />
  )
}
