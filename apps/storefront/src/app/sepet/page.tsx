import type { Metadata } from "next"
import type { StoreProductAddon } from "@qticaret/types"
import { formatLira } from "@qticaret/ui"
import { themeActions } from "@/lib/theme-actions"
import { ADDON_ERROR_KEYS } from "@/lib/addons/errors"
import { viewCartEvents } from "@/lib/analytics/cart-payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { addonsOfProducts } from "@/lib/cart/addons"
import { codesOf, currentCart } from "@/lib/cart/cart"
import { shopperGiftLines } from "@/lib/cart/gift"
import { OUT_OF_STOCK, cartShortLines, outOfStockText } from "@/lib/cart/stock"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { storefrontSettings } from "@/lib/store-api/requests"
import { LINK_CART_LOCKED } from "@/lib/cart/payment-link"
import { cartExtras } from "@/lib/views/cart-extras"
import { currentShared } from "@/lib/views/layout"
import {
  cartLinesOf,
  differs,
  freeShippingOf,
  lockedNoteOf,
  withAddonForms,
  withGiftLines,
} from "@/lib/views/cart"
import { netDiscountOf, netTotalsOf, taxLinesOf } from "@/lib/views/cart-tax"
import { wholesaleMinimumText } from "@/lib/views/cart-wholesale"
import { linePicturesOf, productPathsOf } from "@/lib/views/line-paths"
import { currentWholesale } from "@/lib/account/wholesale"
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
  const [cart, query, settings, shared, wholesale] = await Promise.all([
    currentCart(),
    searchParams,
    storefrontSettings(),
    // The design's badges (adr/0049 Ek 2026-11-06)
    currentShared(),
    // A wholesaler's cart is shown without KDV, the KDV a line of its own (ADR-0068 §5)
    currentWholesale(),
  ])
  const net = cart && wholesale.active && wholesale.vatExclusive ? netTotalsOf(cart) : null
  const asked = typeof query["hata"] === "string" ? query["hata"] : null
  // A line sold out since it was added (adr/0026 Ek 2026-11-06): named as the shelf stands now
  const refused =
    asked === OUT_OF_STOCK
      ? cart
        ? outOfStockText(await cartShortLines(cart.id), t)
        : null
      : asked && CART_ERRORS.has(asked)
        ? t(asked)
        : null
  // A wholesaler's order under its minimum units (ADR-0068 §8), said while it is short
  const error = refused ?? wholesaleMinimumText(cart, wholesale, t)
  // A payment link's cart (adr/0051): its lines as they are, no code, no picks to edit
  const locked = lockedNoteOf(cart, t)
  const [gifts, addons, extras, paths, pictures] = await Promise.all([
    shopperGiftLines(cart?.id),
    // Each product's add-ons, for its lines' picks form (none, and not asked, while the shop has them off)
    locked
      ? new Map<string, StoreProductAddon[]>()
      : addonsOfProducts((cart?.items ?? []).flatMap((line) => line.product_id ?? [])),
    // Shipping before an address, the shop's cart offers, products to add (adr/0046 Ek 2026-11-05)
    cartExtras(cart, t),
    // Each line's product page (a payment link's too); gone or hidden products read as text
    productPathsOf(cart?.items ?? []),
    // Each line's picture in its small versions (the same answer as the paths)
    linePicturesOf(cart?.items ?? []),
  ])
  // A gift card line takes no add-ons (its product page offers none)
  const giftLines = new Set(gifts.map((gift) => gift.line_id))
  const lines = withGiftLines(
    withAddonForms(
      cartLinesOf(cart, paths, pictures, net ? t("cart.line_vat_excluded") : null),
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
    <>
      {/* Once per visit to the cart, not again as its lines change (the frame tells those) */}
      {cart && <TrackEvents events={viewCartEvents(cart)} sendOn={`view_cart:${cart.id}`} />}
      <theme.CartPage
        t={t}
        actions={themeActions}
        view={{
          lines,
          items: formatLira(items),
          discount: net
            ? netDiscountOf(net)
            : differs(items, subtotal)
              ? formatLira(items - subtotal)
              : null,
          subtotal: formatLira(subtotal),
          ...(net ? { tax: taxLinesOf(net, t("cart.wholesale_note")) } : {}),
          // A link's code is the link's own, never shown to copy
          promotions: locked ? [] : codesOf(cart),
          giftCards:
            settings.features?.gift_cards && (gifts.length === 0 || codes.length > 0)
              ? codes
              : null,
          giftNotice:
            gifts.length > 0 && paidByCard ? t("gift_card.not_payable_with_credit") : null,
          credit: cart?.credit_line_total ? formatLira(cart.credit_line_total) : null,
          freeShipping: freeShippingOf(subtotal, settings.free_shipping_threshold, t),
          error,
          locked,
          shipping: extras.shipping ?? null,
          offers: extras.offers ?? [],
          trust: shared.trust_badges,
          // A payment link's cart takes nothing more (adr/0051)
          upsell: locked ? null : (extras.upsell ?? null),
        }}
      />
    </>
  )
}
