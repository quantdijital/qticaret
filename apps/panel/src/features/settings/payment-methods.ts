import type { ProviderAccount } from "@/features/settings/api/payments"

/**
 * The ways a shop takes payment, as Settings > Payment lists them (docs/03
 * F5, F6). A card provider charges the card on its own hosted page; the
 * other methods need no provider. The id is the provider's key in
 * `integration-credentials` and in the page's address.
 */
export const PAYMENT_METHODS = [
  { id: "paytr", group: "card", upcoming: false },
  // Listed so the shop knows they are coming: iyzico in F5 V8, the others in F6
  { id: "iyzico", group: "card", upcoming: true },
  { id: "bank_transfer", group: "other", upcoming: true },
  { id: "cash_on_delivery", group: "other", upcoming: true },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentGroup = PaymentMethod["group"]
/** A method with its own page; the page map is keyed by it, so one cannot be left out. */
export type ConnectableMethod = Extract<PaymentMethod, { upcoming: false }>["id"]

export const PAYMENT_GROUPS: readonly PaymentGroup[] = ["card", "other"]

export function isConnectable(id: string): id is ConnectableMethod {
  return PAYMENT_METHODS.some((method) => method.id === id && !method.upcoming)
}

/** Whether payments go through the provider's test (sandbox) mode: no real money moves. */
export const inTestMode = (account: ProviderAccount | undefined): boolean =>
  account?.settings?.["test_mode"] === true
