import { MedusaError } from "@medusajs/framework/utils"

/**
 * Medusa's own refusals for units the shelf cannot give, as its error text
 * says them (v2.21: the inventory module's `ensureInventoryLevels`,
 * core-flows' `prepareConfirmInventoryInput` and `confirmInventoryStep`).
 * Its words decide, its type (when it travelled) only confirms them: a
 * NOT_ALLOWED alone is also a closed cart or a payment refused.
 */

/** `confirmInventoryStep`: a line's units are more than the shelf has for sale. */
export const INSUFFICIENT_INVENTORY = /^Some variant does not have the required inventory/

/** Every inventory refusal a cart's completion can meet. */
export const STOCK_REFUSALS: readonly RegExp[] = [
  /^Not enough stock available for item \S+ at location \S+/,
  /^Item \S+ is not stocked at location \S+/,
  /^Sales channel \S+ is not associated with any stock location for variant \S+/,
  INSUFFICIENT_INVENTORY,
]

const STOCK_TYPES = new Set<string>([
  MedusaError.Types.NOT_ALLOWED,
  MedusaError.Types.NOT_FOUND,
  MedusaError.Types.INVALID_DATA,
])

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const fieldsOf = (error: unknown): Record<string, unknown> =>
  typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {}

/**
 * True when `error` (an Error or the plain object a workflow run hands
 * back) is one of `patterns`, with no type or one of Medusa's refusal types.
 */
export function isStockRefusal(
  error: unknown,
  patterns: readonly RegExp[] = STOCK_REFUSALS
): boolean {
  const fields = fieldsOf(error)
  const message = textOf(fields["message"])
  const type = textOf(fields["type"])
  return patterns.some((pattern) => pattern.test(message)) && (type === "" || STOCK_TYPES.has(type))
}

/** Medusa's refusal of a line's add or quantity change: more units than are for sale. */
export function isInsufficientInventory(error: unknown): boolean {
  const type = textOf(fieldsOf(error)["type"])
  return (
    isStockRefusal(error, [INSUFFICIENT_INVENTORY]) &&
    (type === "" || type === MedusaError.Types.NOT_ALLOWED)
  )
}
