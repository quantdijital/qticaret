import "server-only"
import { z } from "zod"
import { isStoreApiError } from "../store-api/errors"
import { storeCall, storePost } from "../store-api/server"
import { ageCheck, CONTRACT_KINDS } from "./options"

/** The payment step's form, as the theme sends it (`CheckoutActions.placeOrder`). */
export const PlaceOrder = z.object({
  // A provider, or `credit` when the cart's gift cards leave nothing to pay
  provider_id: z.string().regex(/^(?:pp_[\w-]{1,80}|credit)$/),
  accept: z.literal("on").optional(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  age_confirm: z.literal("on").optional(),
  marketing_email: z.literal("on").optional(),
  marketing_sms: z.literal("on").optional(),
  marketing_version: z
    .string()
    .regex(/^[\w.-]{1,40}$/)
    .optional(),
  challenge: z
    .string()
    .regex(/^[\w.-]{1,300}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

export type PlaceOrderInput = z.infer<typeof PlaceOrder> & { contracts: string[] }

const CONTRACT = /^(pre_information|distance_sales):(\d{1,6})$/

/** The contract versions the shopper saw (`kind:version`), as the backend takes them. */
export function contractsOf(values: string[]): { kind: string; version: number }[] {
  return values.flatMap((value) => {
    const match = CONTRACT.exec(value)
    return match?.[1] && (CONTRACT_KINDS as string[]).includes(match[1])
      ? [{ kind: match[1], version: Number(match[2]) }]
      : []
  })
}

/**
 * The consents before the payment (adr/0041 §2, §4; F10): the contracts
 * shown, the age when the cart asks one, and the marketing boxes ticked.
 * A refusal comes back as its message key; the backend enforces each again.
 */
export async function acceptTerms(cartId: string, input: PlaceOrderInput): Promise<string | null> {
  const documents = contractsOf(input.contracts)
  if (documents.length > 0) {
    if (input.accept !== "on") {
      return "checkout.accept_required"
    }
    await storePost(`/store/carts/${encodeURIComponent(cartId)}/legal-consents`, { documents })
  }
  const age = await ageCheck(cartId)
  if (age.required && !age.declared) {
    if (!input.birth_date || input.age_confirm !== "on") {
      return "checkout.age_required"
    }
    await storeCall(`/store/carts/${encodeURIComponent(cartId)}/age-declaration`, {
      method: "POST",
      body: { birth_date: input.birth_date, confirmed: true },
    })
  }
  if (input.marketing_version && (input.marketing_email || input.marketing_sms)) {
    await storePost(`/store/carts/${encodeURIComponent(cartId)}/consents`, {
      email: input.marketing_email === "on",
      sms: input.marketing_sms === "on",
      text_version: input.marketing_version,
    })
  }
  return null
}

/** The backend's refusals a shopper can act on, by key; anything else is the step's own message. */
const KNOWN = new Set([
  "messaging.email_domain_refuses",
  "legal.version_changed",
  "legal.consent_missing",
  "age.under_limit",
  "age.birth_date_invalid",
  "age.declaration_missing",
  "fraud.checkout_refused",
  "fraud.velocity",
  "cart.shipping_changed",
  "cart.shipping_method_required",
  "cart.address_required",
  "cart.phone_required",
  "cart.email_required",
  "payments.cart_changed",
  "promotions.one_code",
  "errors.too_many_requests",
  // A gift card line not ready to pay (adr/0025 Ek 2026-11-03)
  "gift_card.recipient_required",
  "gift_card.sale_disabled",
  "gift_card.not_payable_with_credit",
  // A line's add-on picks not ready to pay (adr/0052): fixed in the cart
  "addons.unavailable",
  "addons.required",
  "addons.max_quantity",
  "catalog.addons_disabled",
  "cart.prices_changed",
  // A payment link's cart (adr/0051): the link closed, a newer cart, lines or prices moved;
  // its code on another cart; cash on delivery
  "cart.payment_link_closed",
  "cart.payment_link_superseded",
  "cart.payment_link_changed",
  "cart.payment_link_prices_changed",
  "cart.payment_link_code_misused",
  "cart.payment_link_no_cod",
  // A wholesale cart the backend could not set right before paying (ADR-0068 slice 4 review Y2);
  // a theme that does not list it says its own "could not complete" words
  "wholesale.payment_unavailable",
  // A dated line not ready to pay (adr/0076 Ek D3): its departure is picked again from the cart
  "booking.hold_expired",
  "booking.hold_mismatch",
  "booking.price_changed",
  "booking.slot_closed",
  "booking.sales_closed",
  "booking.slot_unknown",
  // A dated line's travelers not in or no longer right (adr/0076 Ek D6b): its step opens again
  "booking.travelers_missing",
  "booking.travelers_invalid",
  // A shipping method left on a cart that ships nothing any more (adr/0076 Ek D3)
  "cart.shipping_not_needed",
])

/**
 * `wholesale.prices_changed` is the same refusal for a cart not at its
 * customer's prices now (ADR-0068 slice 4): a wholesaler closed, removed
 * or repriced since the lines were priced, or a campaign left on a
 * wholesaler's cart. The backend priced it again; the shopper sees the
 * cart's own "prices updated" words.
 */
const PRICES_CHANGED = new Set(["cart.prices_changed", "wholesale.prices_changed"])

/**
 * An add-on line's price moved since it was put in the cart (adr/0052 §5),
 * or a wholesale cart's (`PRICES_CHANGED`): the backend set it at its price
 * now and stopped the payment. The page is drawn again with the new totals
 * and the shopper starts the payment again; never retried by itself (the
 * price shown before paying is the one paid).
 */
export const pricesChanged = (error: unknown): boolean =>
  isStoreApiError(error) && error.status === 409 && PRICES_CHANGED.has(error.messageKey ?? "")

/**
 * A wholesaler's cart short of its minimum units (ADR-0068 §8): fixed in
 * the cart, whose page says the minimum and the count.
 */
export const shortOfMinimum = (error: unknown): boolean =>
  isStoreApiError(error) && error.messageKey === "wholesale.min_quantity"

export function checkoutError(error: unknown, fallback: string): string {
  if (!isStoreApiError(error)) {
    return fallback
  }
  if (error.status === 429 && error.messageKey !== "fraud.velocity") {
    return "errors.too_many_requests"
  }
  if (error.status >= 500) {
    return "checkout.provider_down"
  }
  const key = error.messageKey ?? ""
  if (KNOWN.has(key)) {
    return key
  }
  // Said in the words the theme already has for it
  if (PRICES_CHANGED.has(key)) {
    return "cart.prices_changed"
  }
  if (key.startsWith("tr_address.")) {
    const issues = (error.body as { issues?: { code?: unknown }[] } | null)?.issues ?? []
    const codes = [key, ...issues.map((issue) => String(issue.code))]
    return codes.includes("tr_address.phone_invalid")
      ? "checkout.phone_invalid"
      : "checkout.location_required"
  }
  if (key.startsWith("cash_on_delivery.")) {
    return "checkout.cod_unavailable"
  }
  return fallback
}
