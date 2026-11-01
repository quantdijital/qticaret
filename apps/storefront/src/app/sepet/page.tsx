import type { Metadata } from "next"
import { formatLira } from "@qticaret/ui"
import { addToCart, changeCartLine } from "@/app/actions/cart"
import { currentCart } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { storefrontSettings } from "@/lib/store-api/requests"
import { freeShippingOf } from "@/lib/views/cart"
import { theme } from "@/theme"

// docs/13 §7: the cart is noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("cart.title"))

const CART_ERRORS = new Set([
  "cart.quantity_invalid",
  "cart.update_failed",
  "errors.too_many_requests",
])

/** Discounts in kuruş are compared rounded: no "−0,00 TL" from float noise. */
const differs = (a: number, b: number) => Math.round(a * 100) !== Math.round(b * 100)

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
  const lines = (cart?.items ?? []).map((line) => ({
    id: line.id,
    title: line.title,
    detail: line.variant_title ?? line.subtitle,
    quantity: line.quantity,
    total: formatLira(line.total),
    original: differs(line.original_total, line.total) ? formatLira(line.original_total) : null,
    image: line.thumbnail
      ? {
          src: line.thumbnail,
          alt: line.title,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
  }))
  const items = cart?.original_item_total ?? 0
  const subtotal = cart?.item_total ?? 0
  return (
    <theme.CartPage
      t={t}
      actions={{ addToCart, changeCartLine }}
      view={{
        lines,
        items: formatLira(items),
        discount: differs(items, subtotal) ? formatLira(items - subtotal) : null,
        subtotal: formatLira(subtotal),
        freeShipping: freeShippingOf(subtotal, settings.free_shipping_threshold, t),
        error,
      }}
    />
  )
}
