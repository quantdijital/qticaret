/**
 * Whether anything in the cart is shipped (adr/0076 §6): Medusa marks a
 * line of a digital or service product, a gift card among them, with
 * `requires_shipping: false`. A line that does not say is shipped, as the
 * backend's checkout rules read it (`lib/checkout/rules.ts`), so a cart
 * read without the field keeps today's three steps.
 */
export function cartShips(
  items: readonly { requires_shipping?: boolean | null }[] | null | undefined
): boolean {
  const lines = items ?? []
  return lines.length === 0 || lines.some((line) => line.requires_shipping !== false)
}
