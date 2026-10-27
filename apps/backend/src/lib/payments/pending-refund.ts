import type { Kurus } from "../money"

/**
 * The reference our refund workflow chose for the refund under way (the
 * panel's key for the request), when it is for this amount: Medusa gives
 * every try of a refund a new key of its own (F5 V5).
 */
export function pendingReferenceOf(
  data: Record<string, unknown> | undefined,
  amount: Kurus
): string | undefined {
  const pending = data?.["pending_refund"] as
    { reference_no?: unknown; amount?: unknown } | undefined
  return pending?.amount === amount && typeof pending.reference_no === "string"
    ? pending.reference_no
    : undefined
}
