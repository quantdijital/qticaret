import "server-only"
import { cache } from "react"
import { isStoreApiError } from "../store-api/errors"
import { storeCall, storeGet, storePost } from "../store-api/server"
import { claimsOf, sessionToken } from "./session"

/**
 * The customer's sign-in calls (D8, adr/0004, adr/0037): Medusa's
 * email-and-password provider with the backend's own rules (password
 * policy, e-mail verification bound to the asking identity, proof of
 * work). Each answer's key goes back to the caller; nothing is kept here.
 */

/** The bot checks' answers (`store-api/gate.ts`): sent as they came, nothing when none. */
const challenged = (gate: Record<string, string>) =>
  Object.keys(gate).length > 0 ? { headers: gate } : {}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

export type LoginAnswer = { kind: "signed_in"; token: string } | { kind: "verify"; token: string }

export async function login(
  email: string,
  password: string,
  gate: Record<string, string> = {}
): Promise<LoginAnswer> {
  const answer = await storeCall<{ token: string; verification_required?: boolean }>(
    "/auth/customer/emailpass",
    { method: "POST", body: { email, password }, ...challenged(gate) }
  )
  return answer.verification_required
    ? { kind: "verify", token: answer.token }
    : { kind: "signed_in", token: answer.token }
}

/** A new login: the registration key, with no account behind it yet. */
export async function registerIdentity(
  email: string,
  password: string,
  gate: Record<string, string> = {}
): Promise<string> {
  const { token } = await storeCall<{ token: string }>("/auth/customer/emailpass/register", {
    method: "POST",
    body: { email, password },
    ...challenged(gate),
  })
  return token
}

/** The account behind a registration key; its e-mail is the login's, whatever is sent. */
export function createCustomer(
  token: string,
  details: { first_name: string; last_name: string; phone?: string }
) {
  return storeCall<{ customer: { id: string } }>("/store/customers", {
    method: "POST",
    body: details,
    headers: bearer(token),
  })
}

/**
 * Mails a verification code (and the link to `/hesap/dogrula`) to the
 * login's own address; Turnstile's `verification` token on every request
 * (adr/0044 Ek 2026-11-24) goes beside the login's key.
 */
export function requestVerification(
  token: string,
  email: string,
  gate: Record<string, string> = {}
) {
  return storeCall("/auth/verification/request", {
    method: "POST",
    body: { entity_id: email, entity_type: "email" },
    headers: { ...gate, ...bearer(token) },
  })
}

export function confirmVerification(token: string, code: string) {
  return storeCall<{ verified_at: string }>("/auth/verification/confirm", {
    method: "POST",
    body: { code },
    headers: bearer(token),
  })
}

/** A fresh key for the same login; after verification it names the account. */
export async function refreshToken(token: string): Promise<string> {
  const answer = await storeCall<{ token: string }>("/auth/token/refresh", {
    method: "POST",
    headers: bearer(token),
  })
  return answer.token
}

/** Turnstile on every request (adr/0044 Ek 2026-11-24): the token in `gate`. */
export function requestPasswordReset(email: string, gate: Record<string, string> = {}) {
  return storeCall("/auth/customer/emailpass/reset-password", {
    method: "POST",
    body: { identifier: email },
    ...challenged(gate),
  })
}

/** The new password with the reset link's key (a quarter of an hour long). */
export function resetPassword(token: string, password: string) {
  return storeCall("/auth/customer/emailpass/update", {
    method: "POST",
    body: { password },
    headers: bearer(token),
  })
}

export interface StoreCustomer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

/**
 * The signed-in customer; null without a session (or with one the backend
 * no longer takes). Without a session cookie, or with a token past its end
 * (never sent, `store-api/server.ts`), nothing is asked: the answer is a
 * 401 every time (docs/21). Asked once per request (the layout and the
 * page both want it).
 */
export const currentCustomer = cache(async (): Promise<StoreCustomer | null> => {
  const token = await sessionToken()
  const exp = token ? claimsOf(token).exp : undefined
  if (!token || (exp !== undefined && exp * 1000 <= Date.now())) {
    return null
  }
  try {
    const { customer } = await storeGet<{ customer: StoreCustomer }>("/store/customers/me", {
      fields: "id,email,first_name,last_name,phone",
    })
    return customer
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
})

/** The shopper's open cart becomes the customer's (Medusa's cart transfer). */
export function claimCart(cartId: string, token: string) {
  return storeCall(`/store/carts/${encodeURIComponent(cartId)}/customer`, {
    method: "POST",
    body: {},
    headers: bearer(token),
  })
}

/** An invited customer takes their migrated records (F14 G6); the record's e-mail must be the login's. */
export function claimMigration(key: string, token: string) {
  return storeCall("/store/customers/me/migration-claim", {
    method: "POST",
    body: { token: key },
    headers: bearer(token),
  })
}

export interface CustomerAddress {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
}

const ADDRESS_FIELDS =
  "id,first_name,last_name,phone,address_1,address_2,city,province,postal_code,country_code"

/** The signed-in customer's saved addresses, newest first (Medusa's address book). */
export async function customerAddresses(): Promise<CustomerAddress[]> {
  try {
    const { addresses } = await storeGet<{ addresses: CustomerAddress[] }>(
      "/store/customers/me/addresses",
      { fields: ADDRESS_FIELDS, order: "-created_at", limit: 20 }
    )
    return addresses
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLocaleLowerCase("tr") === (b ?? "").trim().toLocaleLowerCase("tr")

/**
 * Keeps an address the customer typed at checkout in their book, once:
 * the same street, neighbourhood, district and province is not added again.
 */
export async function rememberAddress(address: Omit<CustomerAddress, "id">): Promise<void> {
  const known = await customerAddresses()
  const exists = known.some(
    (each) =>
      same(each.address_1, address.address_1) &&
      same(each.address_2, address.address_2) &&
      same(each.city, address.city) &&
      same(each.province, address.province)
  )
  if (!exists) {
    await storePost("/store/customers/me/addresses", address)
  }
}
