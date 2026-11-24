import "server-only"
import { storefrontEnv } from "../env"
import { isStoreApiError } from "../store-api/errors"
import { storeCall, storeGet, storePost } from "../store-api/server"
import type { PaymentOutcome } from "./waiting"

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

/** Where the provider sends the shopper back: two pages of ours. */
export function returnUrls(): { success: string; failure: string } {
  const origin = storefrontEnv().STOREFRONT_ORIGIN
  return { success: `${origin}/odeme/sonuc`, failure: `${origin}/odeme/sonuc/hata` }
}

/** Nothing left to pay: the cart's gift cards cover it (F4.8); the backend's `credit`. */
export const CREDIT_CHECKOUT = "credit"

// Ways that send nobody anywhere; `credit` starts no session at all
export const OFFLINE_PROVIDERS = new Set([
  "pp_bank-transfer_bank-transfer",
  "pp_cod_cod",
  CREDIT_CHECKOUT,
])

/**
 * POST payment-session; the bot checks' answers ride along as headers
 * (`store-api/gate.ts`): Turnstile's token on every start (adr/0044 Ek
 * 2026-11-24), a solved proof of work when one was asked.
 */
export async function startPayment(
  cartId: string,
  providerId: string,
  gate: Record<string, string> = {}
): Promise<PaymentSession> {
  const offline = OFFLINE_PROVIDERS.has(providerId)
  const { payment_session } = await storeCall<{ payment_session: PaymentSession }>(
    `/store/carts/${encodeURIComponent(cartId)}/payment-session`,
    {
      method: "POST",
      body: offline
        ? { provider_id: providerId }
        : { provider_id: providerId, return_urls: returnUrls() },
      ...(Object.keys(gate).length > 0 ? { headers: gate } : {}),
    }
  )
  return payment_session
}

/** A cart's total and its payment collection's sessions, as the store API answers them. */
export interface SessionFacts {
  total: number
  payment_collection?: {
    payment_sessions?: ({ id: string; amount: number | string } | null)[] | null
  } | null
}

const kurus = (amount: number | string) => Math.round(Number(amount) * 100)

/**
 * Whether a started payment's session still charges what the cart owes
 * now. A change to the cart (a code, a quantity) brings its payment
 * collection up to the new total and can drop its sessions, so a card
 * form made before may be for a session gone, or for an old amount; the
 * backend would refund such a payment (adr/0026), the shopper is sent to
 * start a new one instead.
 */
export function sessionMatches(cart: SessionFacts, sessionId: string): boolean {
  const session = cart.payment_collection?.payment_sessions?.find((each) => each?.id === sessionId)
  if (!session) {
    return false
  }
  return kurus(session.amount) === kurus(cart.total)
}

/** `sessionMatches` for the cart as the backend holds it now. */
export async function sessionCurrent(cartId: string, sessionId: string): Promise<boolean> {
  const { cart } = await storeGet<{ cart: SessionFacts }>(
    `/store/carts/${encodeURIComponent(cartId)}`,
    {
      fields:
        "total,payment_collection.payment_sessions.id,payment_collection.payment_sessions.amount",
    }
  )
  return sessionMatches(cart, sessionId)
}

export type Completion =
  { type: "order"; order: { id: string } } | { type: "cart"; error?: unknown }

/** An offline payment's order: the cart completes now (bank transfer awaits the money). */
export async function completeCart(cartId: string): Promise<string | null> {
  const answer = await storePost<Completion>(
    `/store/carts/${encodeURIComponent(cartId)}/complete`,
    {}
  )
  return answer.type === "order" ? answer.order.id : null
}

/**
 * The order a cart became and its key (adr/0037 §2), or null while the
 * provider's notice has not come yet.
 */
export async function orderAccess(cartId: string): Promise<{ id: string; token: string } | null> {
  try {
    const { order_id, token } = await storePost<{ order_id: string; token: string }>(
      `/store/carts/${encodeURIComponent(cartId)}/order-access`,
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

/**
 * What became of the cart's card payment (adr/0026 Ek 2026-11-06): its
 * order and key; the money being given back (409 `payments.refunding`);
 * or nothing yet, while the provider's notice has not come.
 */
export async function paymentOutcome(cartId: string): Promise<PaymentOutcome> {
  try {
    const access = await orderAccess(cartId)
    return access ? { state: "ordered", ...access } : { state: "pending" }
  } catch (error) {
    if (
      isStoreApiError(error) &&
      error.status === 409 &&
      error.messageKey === "payments.refunding"
    ) {
      return { state: "refund" }
    }
    throw error
  }
}

/** The order page's address, with its key. */
export const orderPath = (id: string, token: string, fresh = false) =>
  `/siparis/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}${fresh ? "&yeni=1" : ""}`
