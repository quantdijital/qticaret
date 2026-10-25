/**
 * Checkout rules Medusa leaves open (F3.2), as error keys; pure, so tested
 * on its own. The completeCartWorkflow `validate` hook throws them.
 * - KDV is worked out from the shipping address's country: without one an
 *   order would carry no tax. Medusa fills it in a single-country region;
 *   this keeps a cart in a region of several from slipping through.
 * - A cart with nothing to ship must not pay for shipping: a method left
 *   over from a removed physical item is refused, not charged.
 */

export interface CheckoutCart {
  shipping_address?: { country_code?: string | null } | null
  items?: ({ requires_shipping?: boolean | null } | null)[] | null
  shipping_methods?: ({ id: string } | null)[] | null
}

export type CheckoutProblem =
  | { key: "cart.address_required"; field: "shipping_address" }
  | {
      key: "cart.shipping_not_needed"
      field: "shipping_methods"
    }

export function checkoutProblem(cart: CheckoutCart): CheckoutProblem | null {
  if (!cart.shipping_address?.country_code) {
    return { key: "cart.address_required", field: "shipping_address" }
  }
  const ships = (cart.items ?? []).some((item) => item !== null && item.requires_shipping !== false)
  if (!ships && (cart.shipping_methods ?? []).some(Boolean)) {
    return { key: "cart.shipping_not_needed", field: "shipping_methods" }
  }
  return null
}
