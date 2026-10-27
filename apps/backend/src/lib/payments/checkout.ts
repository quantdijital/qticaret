import { z } from "@medusajs/framework/zod"
import type { Env } from "../env"

/**
 * What our Store route builds on the server for a hosted payment form
 * (adr/0026 §1): the buyer and the basket from the stored cart, the
 * shopper's address and where the form returns to. A hosted-form provider
 * reads it from the session's input `data` and blanks it in its output,
 * since a session's data is public (Store responses carry it).
 */

/** Set in the session's `context` by our route only: Medusa's own session route never sets it. */
export const HOSTED_CHECKOUT = "qt_hosted_checkout"

/** PayTR's hosted form: `pp_<identifier>_<id>` from medusa-config. */
export const PAYTR_PAYMENT_PROVIDER_ID = "pp_paytr_paytr"

/** iyzico's Checkout Form (F5 V9). */
export const IYZICO_PAYMENT_PROVIDER_ID = "pp_iyzico_iyzico"

/** Providers whose payments start from our route only. */
export const HOSTED_FORM_PROVIDERS = [
  PAYTR_PAYMENT_PROVIDER_ID,
  IYZICO_PAYMENT_PROVIDER_ID,
] as const

/** Bank transfer (F6, adr/0029): the order waits for the money. */
export const BANK_TRANSFER_PAYMENT_PROVIDER_ID = "pp_bank-transfer_bank-transfer"

/** Ways to pay with no outside service (adr/0029); they start from our route too. */
export const OFFLINE_PROVIDERS = [BANK_TRANSFER_PAYMENT_PROVIDER_ID] as const

/** Every provider a storefront starts a payment with, through our route only. */
export const CHECKOUT_PROVIDERS = [...HOSTED_FORM_PROVIDERS, ...OFFLINE_PROVIDERS] as const

export const isHostedFormProvider = (providerId: string): boolean =>
  (HOSTED_FORM_PROVIDERS as readonly string[]).includes(providerId)

/**
 * Where a hosted form may send the shopper back: an origin the storefront
 * is served from (`STORE_CORS`), never an address the request names
 * freely (an open redirect). No user info, no backslash (read differently
 * by browsers). The field of the first address refused.
 */
export function returnUrlProblem(
  urls: { success: string; failure: string },
  storeOrigins: readonly string[]
): "return_urls.success" | "return_urls.failure" | null {
  for (const name of ["success", "failure"] as const) {
    const url = new URL(urls[name])
    if (
      urls[name].includes("\\") ||
      url.username !== "" ||
      url.password !== "" ||
      !storeOrigins.includes(url.origin)
    ) {
      return `return_urls.${name}`
    }
  }
  return null
}

/** A Medusa payment session id, as our routes and providers take it. */
export const PAYMENT_SESSION_ID = /^payses_[0-9A-Z]{20,40}$/

const origins = (list: string) =>
  list
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "")

/**
 * The storefront's origins; in development also the admin's, which is the
 * backend's own: its payment test page (adr/0028) is served there.
 */
export function returnOrigins(env: Pick<Env, "NODE_ENV" | "STORE_CORS" | "ADMIN_CORS">): string[] {
  return env.NODE_ENV === "development"
    ? [...origins(env.STORE_CORS), ...origins(env.ADMIN_CORS)]
    : origins(env.STORE_CORS)
}

const text = (max: number) => z.string().trim().min(1).max(max)

export const hostedCheckout = z.object({
  email: z.email().max(100),
  buyer: z.object({
    first_name: text(60),
    last_name: text(60),
    phone: text(20),
    address_1: text(200),
    address_2: z.string().trim().max(200).nullish(),
    city: text(60),
    province: z.string().trim().max(60).nullish(),
    postal_code: z.string().trim().max(10).nullish(),
    country_code: z.string().length(2),
  }),
  ip: text(45),
  return_urls: z.object({ success: z.url(), failure: z.url() }),
  basket: z
    .array(
      z.object({
        id: text(64),
        kind: z.enum(["item", "shipping"]),
        name: text(255),
        quantity: z.number().int().positive(),
        // Kuruş, for the line's whole quantity
        amount: z.number().int().positive(),
      })
    )
    .min(1),
})

export type HostedCheckout = z.infer<typeof hostedCheckout>

/** The storefront's origins (`STORE_CORS`); the first is where a shopper with nowhere else to go is sent. */
export const storeOrigins = (env: Pick<Env, "STORE_CORS">): string[] => origins(env.STORE_CORS)
