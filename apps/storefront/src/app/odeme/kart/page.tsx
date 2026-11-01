import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { checkoutCart } from "@/lib/checkout/cart"
import { paymentFrame } from "@/lib/checkout/payment-cookie"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { summaryOf } from "@/lib/views/checkout"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.card_title"))

/**
 * `/odeme/kart` (D7): PayTR's card form framed on the shop. The form's
 * address comes from the checkout's own cookie (allowed origins only);
 * without one, or once the cart is ordered, back to checkout.
 */
export default async function CardPage() {
  const [frameUrl, cart] = await Promise.all([paymentFrame(), checkoutCart()])
  if (!frameUrl || !cart) {
    redirect("/odeme")
  }
  return (
    <theme.PaymentFramePage
      t={t}
      view={{ frameUrl, summary: summaryOf(cart, t), backPath: "/odeme" }}
    />
  )
}
