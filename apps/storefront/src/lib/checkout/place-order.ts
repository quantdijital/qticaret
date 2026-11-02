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
    await storePost(`/store/carts/${cartId}/legal-consents`, { documents })
  }
  const age = await ageCheck(cartId)
  if (age.required && !age.declared) {
    if (!input.birth_date || input.age_confirm !== "on") {
      return "checkout.age_required"
    }
    await storeCall(`/store/carts/${cartId}/age-declaration`, {
      method: "POST",
      body: { birth_date: input.birth_date, confirmed: true },
    })
  }
  if (input.marketing_version && (input.marketing_email || input.marketing_sms)) {
    await storePost(`/store/carts/${cartId}/consents`, {
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
])

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
