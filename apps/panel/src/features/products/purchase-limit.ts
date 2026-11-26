/** The most a shop may set per order (S5; the server's `MAX_PURCHASE_QUANTITY`). */
export const PURCHASE_LIMIT_MAX = 9999

/** The typed limit as the server takes it: null for none, a whole number from 1, or undefined when wrong. */
export function readLimit(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === "") {
    return null
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined
  }
  const value = Number(trimmed)
  return value >= 1 && value <= PURCHASE_LIMIT_MAX ? value : undefined
}
