import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { checkoutCart } from "@/lib/checkout/cart"
import { sessionCurrent } from "@/lib/checkout/pay"
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
 * without one, or once the cart is ordered, back to checkout. A form whose
 * session no longer charges the cart's total (a code applied or taken off,
 * a quantity changed since) is never framed: back to the payment step,
 * which starts a session for the total now.
 */
export default async function CardPage() {
  const cart = await checkoutCart()
  const frame = cart ? await paymentFrame(cart.id) : null
  if (!frame || !cart) {
    redirect("/odeme")
  }
  const [current, paths] = await Promise.all([
    sessionCurrent(cart.id, frame.session),
    productPathsOf(cart.items),
  ])
  if (!current) {
    redirect("/odeme?hata=payments.cart_changed")
  }
  return (
    <theme.PaymentFramePage
      t={t}
      view={{ frameUrl: frame.url, summary: summaryOf(cart, t, paths), backPath: "/odeme" }}
    />
  )
}
