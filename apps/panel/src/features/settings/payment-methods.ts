import type { ProviderAccount } from "@/features/settings/api/payments"

/**
 * The ways a shop takes payment, as Settings > Payment lists them (docs/03
 * F5, F6). A card provider charges the card on its own hosted page; the
 * other methods need no provider. The id is the provider's key in
 * `integration-credentials` and in the page's address.
 */
export const PAYMENT_METHODS = [
  { id: "paytr", group: "card", upcoming: false, kind: "account" },
  { id: "iyzico", group: "card", upcoming: false, kind: "account" },
  // The shop's own settings, no provider account (F6, adr/0029)
  { id: "bank_transfer", group: "other", upcoming: false, kind: "settings" },
  { id: "cash_on_delivery", group: "other", upcoming: false, kind: "settings" },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentGroup = PaymentMethod["group"]
/** A method with its own page. */
export type ConnectableMethod = Extract<PaymentMethod, { upcoming: false }>["id"]
/** A provider whose account the shop connects; the page map is keyed by it. */
export type AccountMethod = Extract<PaymentMethod, { upcoming: false; kind: "account" }>["id"]

export const PAYMENT_GROUPS: readonly PaymentGroup[] = ["card", "other"]

export function isConnectable(id: string): id is ConnectableMethod {
  return PAYMENT_METHODS.some((method) => method.id === id && !method.upcoming)
}

export function isAccountMethod(id: string): id is AccountMethod {
  return PAYMENT_METHODS.some((method) => method.id === id && method.kind === "account")
}

/** Whether payments go through the provider's test (sandbox) mode: no real money moves. */
export const inTestMode = (account: ProviderAccount | undefined): boolean =>
  account?.settings?.["test_mode"] === true
