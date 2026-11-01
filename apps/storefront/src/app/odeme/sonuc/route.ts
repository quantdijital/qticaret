import { forgetCart, cartIdFromCookie } from "@/lib/cart/cookie"
import { forgetPaymentFrame } from "@/lib/checkout/payment-cookie"
import { orderAccess, orderPath } from "@/lib/checkout/pay"
import { breakOut, framed, seeOther } from "@/lib/checkout/return"
import { t } from "@/lib/i18n"

// About a minute of looking (a refresh every 3 seconds) before "it comes by e-mail"
const TRIES = 20

/**
 * `/odeme/sonuc` (D7): where a card payment comes back. The order is the
 * provider's notice's doing (adr/0026): once the cart has become one, its
 * page with its key; until then a page that looks again by itself.
 * iyzico adds `payment_status` (review, refund) when it has news.
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
  const access = await orderAccess(cartId)
  if (access) {
    await forgetCart()
    await forgetPaymentFrame()
    return seeOther(orderPath(access.id, access.token, true))
  }
  const tries = Math.min(TRIES, Number.parseInt(query.get("deneme") ?? "0", 10) || 0)
  if (status === "review" || tries >= TRIES) {
    return seeOther("/odeme/durum?d=gecikti")
  }
  return seeOther(`/odeme/durum?d=bekliyor&deneme=${String(tries + 1)}`)
}

export const GET = answer
export const POST = answer
