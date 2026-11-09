import { MedusaError } from "@medusajs/framework/utils"
import { isRetryable } from "../errors"

/**
 * What a paid cart's failed completion means (adr/0026 Ek 2026-11-06):
 * - `stock`: the shelf cannot hold the order's units (the last one held by
 *   another order, a level missing at the warehouse). The money is taken,
 *   so the order is placed anyway, short (a backorder), and the shop told.
 * - `refund`: the cart's own rules refuse it (it changed, an address, a
 *   code, a payment fee or account no longer right, a contract published
 *   since, an age not declared, a buyer on the block list, a gift line not
 *   ready). It never will be placed: the money is given back.
 * - `retry`: anything else (a lock, the database, the provider unreachable)
 *   is tried again: money is given back only when the order surely cannot
 *   be placed.
 */
export type CompletionFailure = "stock" | "refund" | "retry"

// The cart's own rules, as the completeCartWorkflow `validate` hook throws them
const CART_RULES =
  /^(cart|payments|promotions|cash_on_delivery|bank_transfer|legal|age|fraud|gift_card)\./

// Medusa's inventory refusals (v2.21: the inventory module's `ensureInventoryLevels`,
// core-flows' `prepareConfirmInventoryInput` and `confirmInventoryStep`)
const STOCK_REFUSALS = [
  /^Not enough stock available for item \S+ at location \S+/,
  /^Item \S+ is not stocked at location \S+/,
  /^Sales channel \S+ is not associated with any stock location for variant \S+/,
  /^Some variant does not have the required inventory/,
]

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
  if (CART_RULES.test(textOf(fields["safeMessage"]))) {
    return "refund"
  }
  const message = textOf(fields["message"])
  const type = textOf(fields["type"])
  // Medusa's words decide, its type (when it travelled) only confirms them: a
  // NOT_ALLOWED alone is also a closed cart or a payment refused
  if (
    STOCK_REFUSALS.some((pattern) => pattern.test(message)) &&
    (type === "" ||
      type === MedusaError.Types.NOT_ALLOWED ||
      type === MedusaError.Types.NOT_FOUND ||
      type === MedusaError.Types.INVALID_DATA)
  ) {
    return "stock"
  }
  return "retry"
}
