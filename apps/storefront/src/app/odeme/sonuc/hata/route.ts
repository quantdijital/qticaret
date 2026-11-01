import { breakOut, framed, seeOther } from "@/lib/checkout/return"
import { t } from "@/lib/i18n"

/** `/odeme/sonuc/hata` (D7): the card was refused; the cart stays open to try again. */
async function answer(request: Request): Promise<Response> {
  if (framed(request)) {
    return breakOut(request, t("checkout.result_continue"))
  }
  return Promise.resolve(seeOther("/odeme/durum?d=hata"))
}

export const GET = answer
export const POST = answer
