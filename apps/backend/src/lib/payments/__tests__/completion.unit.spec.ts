import { MedusaError } from "@medusajs/framework/utils"
import { ConflictError, ProviderError, RetryableError, ValidationError } from "../../errors"
import { completionFailureOf } from "../completion"

// A workflow run hands its errors back as plain objects: their own fields, copied
const plain = (error: Error) => ({
  ...Object.fromEntries(Object.entries(error)),
  message: error.message,
  name: error.name,
})

describe("completionFailureOf (adr/0026 Ek 2026-11-06)", () => {
  it("reads Medusa's stock refusals as the shelf's, not a reason to retry or refund", () => {
    const refusals = [
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Not enough stock available for item iitem_01ABC at location sloc_01DEF"
      ),
      new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Item iitem_01ABC is not stocked at location sloc_01DEF"
      ),
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sales channel sc_01 is not associated with any stock location for variant variant_01."
      ),
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Some variant does not have the required inventory",
        MedusaError.Codes.INSUFFICIENT_INVENTORY
      ),
    ]
    for (const refusal of refusals) {
      expect(completionFailureOf(refusal)).toBe("stock")
      expect(completionFailureOf(plain(refusal))).toBe("stock")
    }
    // Its words without its type (a run that dropped it) are still the shelf's
    expect(
      completionFailureOf({ message: "Not enough stock available for item iitem_1 at location s" })
    ).toBe("stock")
  })

  it("gives the money back only for the cart's own rules", () => {
    for (const key of [
      "cart.shipping_changed",
      "payments.cart_changed",
      "promotions.one_code",
      "cash_on_delivery.fee_mismatch",
      "legal.version_changed",
      "age.declaration_required",
      "fraud.buyer_blocked",
      "gift_card.recipient_required",
      // ADR-0068 slice 4: a wholesale cart's own rules, never passed by trying again
      "wholesale.min_quantity",
      "promotions.wholesale_no_code",
      // adr/0052: a line's add-on picks, or the shop's add-ons switched off
      "addons.unavailable",
      "addons.required",
      "addons.max_quantity",
      "catalog.addons_disabled",
      // adr/0076: a dated line refused (the hold ended, a plain dated item) or bookings off
      "booking.use_booking_route",
      "booking.sales_closed",
      "catalog.booking_disabled",
    ]) {
      expect(completionFailureOf(new ValidationError(key))).toBe("refund")
      expect(completionFailureOf(plain(new ValidationError(key)))).toBe("refund")
    }
    // Only that one catalog refusal is the cart's: the catalog's own checks are not
    expect(completionFailureOf(new ValidationError("catalog.description_blocks"))).toBe("retry")
    // A cart not at its customer's prices now is a conflict, refunded alike
    for (const key of [
      "wholesale.prices_changed",
      "cart.prices_changed",
      "booking.hold_expired",
      "booking.hold_mismatch",
      "booking.price_changed",
    ]) {
      expect(completionFailureOf(new ConflictError(key))).toBe("refund")
      expect(completionFailureOf(plain(new ConflictError(key)))).toBe("refund")
    }
    // A departure gone or no longer sold: Medusa's NOT_FOUND carrying our key
    const gone = new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
    expect(completionFailureOf(gone)).toBe("refund")
    expect(completionFailureOf(plain(gone))).toBe("refund")
  })

  it("refunds a NOT_FOUND only for a booking key, not for other not-found words", () => {
    for (const error of [
      new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown"),
      new MedusaError(MedusaError.Types.NOT_FOUND, "Cart with id: cart_01 was not found"),
      new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown for slot bkslot_1"),
      // The key under another type is not this verdict
      new MedusaError(MedusaError.Types.DB_ERROR, "booking.slot_unknown"),
    ]) {
      expect(completionFailureOf(error)).toBe("retry")
    }
  })

  it("tries anything else again: locks, the database, the provider, what it does not know", () => {
    const transient = [
      new RetryableError("errors.busy"),
      new ProviderError({ provider: "paytr", providerCode: "timeout", retryable: true }),
      new Error("Failed to acquire lock for key cart_01"),
      new Error("Knex: Timeout acquiring a connection. The pool is probably full."),
      Object.assign(new Error("deadlock detected"), { code: "40P01" }),
      new MedusaError(MedusaError.Types.DB_ERROR, "connection terminated unexpectedly"),
      // A NOT_ALLOWED that is not about stock (a payment refused at authorisation)
      new MedusaError(MedusaError.Types.NOT_ALLOWED, "Payment authorization failed"),
      // The words of a stock refusal under a type Medusa never gives them
      new MedusaError(
        MedusaError.Types.DB_ERROR,
        "Not enough stock available for item iitem_1 at location sloc_1"
      ),
      null,
      "boom",
    ]
    for (const error of transient) {
      expect(completionFailureOf(error)).toBe("retry")
    }
  })
})
