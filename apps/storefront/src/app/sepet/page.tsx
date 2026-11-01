import type { Metadata } from "next"
import { formatLira } from "@qticaret/ui"
import { themeActions } from "@/lib/theme-actions"
import { codesOf, currentCart } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { storefrontSettings } from "@/lib/store-api/requests"
import { cartLinesOf, differs, freeShippingOf } from "@/lib/views/cart"
import { theme } from "@/theme"

// docs/13 §7: the cart is noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("cart.title"))

const CART_ERRORS = new Set([
  "cart.quantity_invalid",
  "cart.update_failed",
  "errors.too_many_requests",
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
  const lines = cartLinesOf(cart)
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
        promotions: codesOf(cart),
        freeShipping: freeShippingOf(subtotal, settings.free_shipping_threshold, t),
        error,
      }}
    />
  )
}
