import { forgetCart, cartIdFromCookie } from "@/lib/cart/cookie"
import { forgetPaymentFrame } from "@/lib/checkout/payment-cookie"
import { orderPath, paymentOutcome } from "@/lib/checkout/pay"
import { breakOut, framed, seeOther } from "@/lib/checkout/return"
import { nextWaitingPath, triesOf } from "@/lib/checkout/waiting"
import { t } from "@/lib/i18n"

/**
 * `/odeme/sonuc` (D7): where a card payment comes back. The order is the
 * provider's notice's doing (adr/0026): once the cart has become one, its
 * page with its key; a payment the backend is giving back, its page;
 * until then a page that looks again by itself, with growing pauses for
 * about two minutes, then says the order comes by e-mail (adr/0026 Ek
 * 2026-11-06). iyzico adds `payment_status` (review, refund) when it has news.
 */
async function answer(request: Request): Promise<Response> {
  if (framed(request)) {
    return breakOut(request, t("checkout.result_continue"))
  }
  const query = new URL(request.url).searchParams
  const status = query.get("payment_status")
  if (status === "refund") {
    return seeOther("/odeme/durum?d=iade")
  }
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    return seeOther("/odeme/durum?d=gecikti")
  }
  const outcome = await paymentOutcome(cartId)
  if (outcome.state === "ordered") {
    await forgetCart()
    await forgetPaymentFrame()
    return seeOther(orderPath(outcome.id, outcome.token, true))
  }
  return seeOther(nextWaitingPath(outcome, triesOf(query.get("deneme")), status))
}

export const GET = answer
export const POST = answer
