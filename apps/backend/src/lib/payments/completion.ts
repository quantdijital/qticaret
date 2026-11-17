import { isRetryable } from "../errors"
import { isStockRefusal } from "../stock/refusals"

/**
 * What a paid cart's failed completion means (adr/0026 Ek 2026-11-06):
 * - `stock`: the shelf cannot hold the order's units (the last one held by
 *   another order, a level missing at the warehouse). The money is taken,
 *   so the order is placed anyway, short (a backorder), and the shop told.
 * - `refund`: the cart's own rules refuse it (it changed, an address, a
 *   code, a payment fee or account no longer right, a contract published
 *   since, an age not declared, a buyer on the block list, a gift line not
 *   ready, an add-on pick no longer sold or the add-ons switched off, a
 *   wholesale cart not at its customer's prices now or short of its minimum,
 *   ADR-0068 slice 4). It never will be placed: the money is given back.
 * - `retry`: anything else (a lock, the database, the provider unreachable)
 *   is tried again: money is given back only when the order surely cannot
 *   be placed.
 */
export type CompletionFailure = "stock" | "refund" | "retry"

// The cart's own rules, as the completeCartWorkflow `validate` hook throws them. Every
// `addons.*` key is a verdict on the picks or their product (adr/0052), none a passing fault
const CART_RULES =
  /^(cart|payments|promotions|cash_on_delivery|bank_transfer|legal|age|fraud|gift_card|wholesale|addons)\./

// Rules named in full where their namespace also holds other refusals: `catalog.*` is mostly
// the panel's catalog checks; only the add-ons switched off is the cart's (adr/0052)
const CART_RULE_KEYS = new Set(["catalog.addons_disabled"])

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The kind of an error a completion handed back, plain object or Error alike. */
export function completionFailureOf(error: unknown): CompletionFailure {
  if (isRetryable(error)) {
    return "retry"
  }
  const fields = (typeof error === "object" && error !== null ? error : {}) as Record<
    string,
    unknown
  >
  const rule = textOf(fields["safeMessage"])
  if (CART_RULES.test(rule) || CART_RULE_KEYS.has(rule)) {
    return "refund"
  }
  // Medusa's inventory refusals (`lib/stock/refusals`): its words decide
  return isStockRefusal(error) ? "stock" : "retry"
}
