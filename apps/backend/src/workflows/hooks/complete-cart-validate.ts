import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { checkoutProblem } from "../../lib/checkout"
import { ValidationError } from "../../lib/errors"
import { PAYMENT_FACT_FIELDS, paymentMismatch } from "../../lib/payments/consistency"
import type { PaymentFacts } from "../../lib/payments/consistency"
import { enteredCodes } from "../../lib/promotions"
import { hasStaleShipping } from "../checkout/stale-shipping"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type CartRow = Parameters<typeof checkoutProblem>[0] &
  PaymentFacts & {
    promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
  }

// One handler per hook: the checkout rules of lib/checkout (F3.2), a payment
// for the cart's current total (F5), shipping at its current price (F4.5)
// and the one-code rule (F4.4), read fresh for
// the cart being completed. Throwing
// stops the checkout. The hook's cart is typed loosely: only its id is used
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
  // A code applied after shipping was chosen can leave it at its old price
  if (await hasStaleShipping(container, cart.id)) {
    throw new ValidationError("cart.shipping_changed", { field: "shipping_methods" })
  }
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
