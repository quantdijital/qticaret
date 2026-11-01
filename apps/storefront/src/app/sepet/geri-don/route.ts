import { rememberCart } from "@/lib/cart/cookie"
import { seeOther } from "@/lib/checkout/return"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePost } from "@/lib/store-api/server"

const TOKEN = /^[\w-]{43}$/

/**
 * `/sepet/geri-don?token=` (F10 cart reminders): the reminder e-mail's
 * link. The backend trades the token for the cart's id; the cart becomes
 * this browser's and the shopper lands on it. A spent or wrong link lands
 * on the cart page with a note.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  if (!TOKEN.test(token)) {
    return seeOther("/sepet?hata=cart.link_invalid")
  }
  try {
    const { cart_id } = await storePost<{ cart_id: string }>("/store/cart-reminders/redeem", {
      token,
    })
    await rememberCart(cart_id)
  } catch (error) {
    if (isStoreApiError(error)) {
      return seeOther(
        error.status === 429
          ? "/sepet?hata=errors.too_many_requests"
          : "/sepet?hata=cart.link_invalid"
      )
    }
    throw error
  }
  return seeOther("/sepet")
}
