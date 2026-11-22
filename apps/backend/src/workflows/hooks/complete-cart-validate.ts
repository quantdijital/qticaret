import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { checkoutProblem } from "../../lib/checkout"
import { RetryableError, ValidationError } from "../../lib/errors"
import type { MedusaContainer } from "@medusajs/framework/types"
import { COD_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { FEE_CART_FIELDS, feeFacts, feeLinesMatch } from "../../lib/payments/cod"
import type { FeeCart } from "../../lib/payments/cod"
import { PAYMENT_FACT_FIELDS, paymentMismatch } from "../../lib/payments/consistency"
import type { PaymentFacts } from "../../lib/payments/consistency"
import { kurus } from "../../lib/money"
import { enteredCodes } from "../../lib/promotions"
import { hasStaleShipping } from "../checkout/stale-shipping"
import { assertAgeDeclared } from "../legal/age"
import { assertBuyerNotBlocked } from "../fraud/buyer-blocked"
import { assertConsented } from "../legal/consent"
import { assertGiftLinesReady } from "../gift-cards/cart-gifts"
import { assertAddonLinesCurrent } from "../addons/checkout"
import { assertBookingLinesCurrent } from "../booking/cart/checkout"
import {
  assertLinkCartCompletes,
  claimLinkForCart,
  releaseLinkClaim,
} from "../payment-links/cart-guard"
import type { LinkClaim } from "../payment-links/cart-guard"
import { assertWholesaleCartCompletes } from "../wholesale/checkout"
import { overlapsPlacement } from "./completion-overlap"
import type { HookCart } from "./completion-overlap"
import { expectedCodFee } from "../payments/steps/payment-fee"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type CartRow = Parameters<typeof checkoutProblem>[0] &
  PaymentFacts &
  FeeCart & {
    promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
    order?: { id: string; created_at?: Date | string | null } | null
  }

// One handler per hook: the checkout rules of lib/checkout (F3.2), a payment
// for the cart's current total (F5), the payment fee (F6), shipping at its
// current price (F4.5), the one-code rule (F4.4), the contracts accepted
// as published now (F13.2), a restricted product's buyer's age (F13.3) and
// the wholesale rules (ADR-0068 slice 4), read fresh for the cart being completed.
// Throwing stops the checkout; a cart already an order is never judged (it
// answers with that order), unless that order was placed just now by a run
// Medusa's lock did not hold back (`overlapsPlacement`). Last, a payment link's
// cart holds its link (adr/0051 §5); a completion failing after the hook lets
// go of it. The hook's cart is typed loosely: only its id and Medusa's
// `completed_at` (`completeCartFields`) are used
completeCartWorkflow.hooks.validate(
  async ({ cart }: { cart: HookCart }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: [
        "shipping_address.country_code",
        "items.requires_shipping",
        "shipping_methods.id",
        "promotions.code",
        "promotions.is_automatic",
        "order.id",
        "order.created_at",
        ...PAYMENT_FACT_FIELDS,
        ...FEE_CART_FIELDS,
      ],
      filters: { id: cart.id },
    })
    const row = (data[0] ?? {}) as CartRow
    // A cart that is already an order (a provider's late or repeated notice): Medusa (2.21.2)
    // runs this hook before it answers with that order, so nothing here may refuse it; a
    // refusal would read as a payment without an order and refund a placed order's money
    if (row.order?.id) {
      if (overlapsPlacement(cart, row.order)) {
        // Tried again: the next run answers with that order (review N1); never a refusal
        throw new RetryableError("errors.busy")
      }
      return new StepResponse<undefined, LinkClaim | null>(undefined, null)
    }
    const problem = checkoutProblem(row)
    if (problem) {
      throw new ValidationError(problem.key, { field: problem.field })
    }
    // A payment started while the cart changed can be for the old amount (adr/0026)
    if (paymentMismatch(row)) {
      throw new ValidationError("payments.cart_changed")
    }
    // Cash on delivery's fee as the shop's settings make it now, and only with it (adr/0029)
    await checkPaymentFee(container, row)
    // A code applied after shipping was chosen can leave it at its old price
    if (await hasStaleShipping(container, cart.id)) {
      throw new ValidationError("cart.shipping_changed", { field: "shipping_methods" })
    }
    // Accepted at the payment's start too; a contract published since stops it (adr/0041 §2)
    await assertConsented(container, cart.id)
    // A restricted product's buyer declared their age (adr/0041 §4)
    await assertAgeDeclared(container, cart.id)
    // A buyer on the shop's block list, a card's provider notice included (adr/0044 §4)
    await assertBuyerNotBlocked(container, cart.id)
    // Gift lines name their recipients and are not paid with credit (adr/0025 Ek 2026-11-03)
    await assertGiftLinesReady(container, cart.id, null)
    // Add-on lines still cost what they did when the payment started (adr/0052 §5)
    await assertAddonLinesCurrent(container, cart.id)
    // Dated lines: the hold live and theirs, its places the lines', every price current (adr/0076 §5)
    await assertBookingLinesCurrent(container, cart.id)
    // A payment link's cart: the link still open, this its latest cart, its lines and code as made (adr/0051 §5)
    const linkId = await assertLinkCartCompletes(container, cart.id)
    // A wholesaler's cart: no code, its minimum, and every cart at its customer's prices now,
    // a closed or removed wholesaler's too (ADR-0068 §6–§8, review M1)
    await assertWholesaleCartCompletes(container, cart.id)
    // The rule is checked as codes are sent too; requests racing each other
    // can each see an empty cart, so it is checked once more here (ADR-0024)
    if (enteredCodes(row.promotions).length > 1) {
      const settings = (await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .getSection("promotions")) as unknown as PromotionSettings
      if (!settings.combine_codes) {
        throw new ValidationError("promotions.one_code", { field: "promo_codes" })
      }
    }
    // Of two carts of one link completing at once one holds it, the other is refused here:
    // before its order and its payment's authorization. Nothing throws after this
    const claim = linkId ? await claimLinkForCart(container, linkId, cart.id) : null
    return new StepResponse<undefined, LinkClaim | null>(undefined, claim)
  },
  async (claim, { container }) => {
    await releaseLinkClaim(container, claim)
  }
)

/**
 * The cart pays at the door with exactly the fee it should, and carries no
 * fee otherwise: settings or the cart changed since the payment started,
 * or a fee line was tampered with, and the checkout starts again.
 */
async function checkPaymentFee(container: MedusaContainer, row: CartRow): Promise<void> {
  const live = (row.payment_collection?.payment_sessions ?? []).find(
    (session) => session && session.status !== "canceled" && session.status !== "error"
  )
  const facts = feeFacts(row)
  const expected =
    live?.provider_id === COD_PAYMENT_PROVIDER_ID ? await expectedCodFee(container, row) : kurus(0)
  if (!feeLinesMatch(facts, expected)) {
    throw new ValidationError("cash_on_delivery.fee_mismatch")
  }
}
