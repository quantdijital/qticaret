/**
 * The checkout's refusals by message key (the storefront's actions pass
 * the backend's keys through): each step's form says them in words.
 */

/** Refusals fixed in the cart, not here (adr/0052): the message links there. */
export const CART_FIX_ERRORS = [
  "addons.unavailable",
  "addons.required",
  "addons.max_quantity",
  "catalog.addons_disabled",
  // A payment link's code on another cart (adr/0051): taken off in the cart
  "cart.payment_link_code_misused",
  // A dated line's hold or departure (adr/0076 §10): picked again from the cart
  "booking.hold_expired",
  "booking.hold_mismatch",
  "booking.price_changed",
  "booking.slot_closed",
  "booking.sales_closed",
  "booking.slot_unknown",
]

/** A payment link's cart that can no longer be paid (adr/0051): the way out is home. */
export const LINK_ERRORS = [
  "cart.payment_link_closed",
  "cart.payment_link_superseded",
  "cart.payment_link_changed",
  "cart.payment_link_prices_changed",
]

export const CHECKOUT_ERRORS = [
  "checkout.address_invalid",
  "checkout.email_invalid",
  "checkout.phone_invalid",
  "checkout.name_required",
  "checkout.location_required",
  "checkout.street_required",
  "checkout.shipping_required",
  "checkout.shipping_failed",
  "checkout.payment_required",
  "checkout.accept_required",
  "checkout.age_required",
  "checkout.provider_down",
  "checkout.cod_unavailable",
  "checkout.failed",
  "messaging.email_domain_refuses",
  "legal.version_changed",
  "legal.consent_missing",
  "age.under_limit",
  "age.birth_date_invalid",
  "age.declaration_missing",
  "fraud.checkout_refused",
  "fraud.velocity",
  "cart.shipping_changed",
  "cart.shipping_method_required",
  "cart.address_required",
  "cart.phone_required",
  "cart.email_required",
  "payments.cart_changed",
  "promotions.one_code",
  "errors.too_many_requests",
  "errors.challenge_failed",
  "errors.turnstile_failed",
  "gift_card.recipient_required",
  "gift_card.sale_disabled",
  "gift_card.not_payable_with_credit",
  // Also a wholesale cart's `wholesale.prices_changed`, said in these words by the storefront
  "cart.prices_changed",
  // A wholesale cart the backend could not set right before paying (ADR-0068 slice 4 Y2).
  // `wholesale.min_quantity` never reaches the form: the storefront goes back to the cart
  "wholesale.payment_unavailable",
  ...CART_FIX_ERRORS,
  ...LINK_ERRORS,
  "cart.payment_link_no_cod",
  "cart.shipping_not_needed",
  // A dated product's travelers (adr/0076 Ek D6b): their step's refusals, and the payment's
  "booking.travelers_missing",
  "booking.travelers_invalid",
  "checkout.traveler_name_required",
  "checkout.traveler_birth_date_invalid",
  "checkout.traveler_document_invalid",
  "checkout.traveler_nationality_required",
]
