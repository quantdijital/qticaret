import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { checkoutProblem } from "../../lib/checkout"
import { ValidationError } from "../../lib/errors"
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
import { assertConsented } from "../legal/consent"
import { expectedCodFee } from "../payments/steps/payment-fee"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type CartRow = Parameters<typeof checkoutProblem>[0] &
  PaymentFacts &
  FeeCart & {
    promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
  }

// One handler per hook: the checkout rules of lib/checkout (F3.2), a payment
// for the cart's current total (F5), the payment fee (F6), shipping at its
// current price (F4.5), the one-code rule (F4.4), the contracts accepted
// as published now (F13.2) and a restricted product's buyer's age (F13.3),
// read fresh for the cart being completed.
// Throwing stops the checkout. The hook's cart is typed
// loosely: only its id is used
completeCartWorkflow.hooks.validate(async ({ cart }: { cart: { id: string } }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "shipping_address.country_code",
      "items.requires_shipping",
      "shipping_methods.id",
      "promotions.code",
      "promotions.is_automatic",
      ...PAYMENT_FACT_FIELDS,
      ...FEE_CART_FIELDS,
    ],
    filters: { id: cart.id },
  })
  const row = (data[0] ?? {}) as CartRow
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
})

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
