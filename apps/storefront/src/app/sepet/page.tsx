import type { Metadata } from "next"
import { formatLira } from "@qticaret/ui"
import { currentCart } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { theme } from "@/theme"

// docs/13 §7: the cart is noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("cart.title"))

export default async function CartPage() {
  const cart = await currentCart()
  const lines = (cart?.items ?? []).map((line) => ({
    id: line.id,
    title: line.title,
    detail: line.variant_title ?? line.subtitle,
    quantity: line.quantity,
    total: formatLira(line.total),
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
  return <theme.CartPage t={t} view={{ lines, subtotal: formatLira(cart?.item_total ?? 0) }} />
}
