import "server-only"
import { storefrontEnv } from "../env"
import { isStoreApiError } from "../store-api/errors"
import { storeCall, storePost } from "../store-api/server"

/**
 * Starting and finishing a payment (D7, adr/0026, adr/0029). The amount,
 * the basket and the buyer come from the stored cart on the backend; the
 * storefront sends only the way to pay and where to come back to.
 */

export interface PaymentSession {
  id: string
  provider_id: string
  status: string
  data: Record<string, unknown>
}

export interface Challenge {
  token: string
  salt: string
  bits: number
}

/** A 428's challenge (adr/0044), or null for any other failure. */
export function challengeOf(error: unknown): Challenge | null {
  if (!isStoreApiError(error) || error.status !== 428) {
    return null
  }
  const challenge = (error.body as { challenge?: Partial<Challenge> } | null)?.challenge
  return typeof challenge?.token === "string" &&
    typeof challenge.salt === "string" &&
    typeof challenge.bits === "number"
    ? { token: challenge.token, salt: challenge.salt, bits: challenge.bits }
    : null
}

/** Where the provider sends the shopper back: two pages of ours. */
export function returnUrls(): { success: string; failure: string } {
  const origin = storefrontEnv().STOREFRONT_ORIGIN
  return { success: `${origin}/odeme/sonuc`, failure: `${origin}/odeme/sonuc/hata` }
}

export const OFFLINE_PROVIDERS = new Set(["pp_bank-transfer_bank-transfer", "pp_cod_cod"])

/** POST payment-session; the solved challenge, when there is one, rides in `X-Challenge`. */
export async function startPayment(
  cartId: string,
  providerId: string,
  challenge: string | null
): Promise<PaymentSession> {
  const offline = OFFLINE_PROVIDERS.has(providerId)
  const { payment_session } = await storeCall<{ payment_session: PaymentSession }>(
    `/store/carts/${cartId}/payment-session`,
    {
      method: "POST",
      body: offline
        ? { provider_id: providerId }
        : { provider_id: providerId, return_urls: returnUrls() },
      ...(challenge ? { headers: { "x-challenge": challenge } } : {}),
    }
  )
  return payment_session
}

export type Completion =
  { type: "order"; order: { id: string } } | { type: "cart"; error?: unknown }

/** An offline payment's order: the cart completes now (bank transfer awaits the money). */
export async function completeCart(cartId: string): Promise<string | null> {
  const answer = await storePost<Completion>(`/store/carts/${cartId}/complete`, {})
  return answer.type === "order" ? answer.order.id : null
}

/**
 * The order a cart became and its key (adr/0037 §2), or null while the
 * provider's notice has not come yet.
 */
export async function orderAccess(cartId: string): Promise<{ id: string; token: string } | null> {
  try {
    const { order_id, token } = await storePost<{ order_id: string; token: string }>(
      `/store/carts/${cartId}/order-access`,
      {}
    )
    return { id: order_id, token }
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

/** The order page's address, with its key. */
export const orderPath = (id: string, token: string, fresh = false) =>
  `/siparis/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}${fresh ? "&yeni=1" : ""}`
