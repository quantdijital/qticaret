import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { checkoutCart } from "@/lib/checkout/cart"
import { paymentFrame } from "@/lib/checkout/payment-cookie"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { summaryOf } from "@/lib/views/checkout"
import { productPathsOf } from "@/lib/views/line-paths"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.card_title"))

/**
 * `/odeme/kart` (D7): PayTR's card form framed on the shop. The form's
 * address comes from the checkout's own cookie (allowed origins only);
 * without one, or once the cart is ordered, back to checkout.
 */
export default async function CardPage() {
  const cart = await checkoutCart()
  const frameUrl = cart ? await paymentFrame(cart.id) : null
  if (!frameUrl || !cart) {
    redirect("/odeme")
  }
  const paths = await productPathsOf(cart.items)
  return (
    <theme.PaymentFramePage
      t={t}
      view={{ frameUrl, summary: summaryOf(cart, t, paths), backPath: "/odeme" }}
    />
  )
}
