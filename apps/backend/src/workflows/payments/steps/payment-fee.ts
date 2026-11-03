import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { addToCartWorkflow, deleteLineItemsWorkflow } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { kurus, toMedusaAmount } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import { COD_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import {
  COD_FEE,
  FEE_CART_FIELDS,
  codFee,
  codRefusal,
  feeFacts,
  feeLinesMatch,
} from "../../../lib/payments/cod"
import type { FeeCart } from "../../../lib/payments/cod"
import { cashOnDeliverySettings } from "../../../lib/payments/settings"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CASH_ON_DELIVERY } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

/**
 * Whether the cart may be paid at the door, and the fee it should carry
 * (adr/0029 §5–6): read from the cart and the shop's settings, never from
 * the request. Throws why not.
 */
export async function expectedCodFee(container: MedusaContainer, cart: FeeCart): Promise<Kurus> {
  const [settings, enabled] = await Promise.all([
    cashOnDeliverySettings(container),
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(CASH_ON_DELIVERY),
  ])
  const facts = feeFacts(cart)
  const refusal = codRefusal(settings, enabled, {
    amount: facts.base,
    shipping_option_ids: facts.shipping_option_ids,
  })
  if (refusal) {
    throw new ValidationError(refusal)
  }
  return codFee(settings, facts.base)
}

/** The cart as the fee rules read it. */
export async function readFeeCart(container: MedusaContainer, cartId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    // Its metadata: a payment link's cart is paid at the door only when allowed (adr/0051)
    fields: ["sales_channel_id", "completed_at", "metadata", ...FEE_CART_FIELDS],
    filters: { id: cartId },
  })
  return data[0] as
    | (FeeCart & { sales_channel_id?: string | null; completed_at?: unknown; metadata?: unknown })
    | undefined
}

/** The fee a cart carried before a start changed it: put back if the start fails. */
interface FeeChange {
  cart_id: string
  before: Kurus
}

async function setFee(container: MedusaContainer, cartId: string, fee: Kurus) {
  const cart = await readFeeCart(container, cartId)
  const { lines } = feeFacts(cart ?? {})
  if (lines.length > 0) {
    await deleteLineItemsWorkflow(container).run({
      input: { cart_id: cartId, ids: lines.map((line) => line.id) },
    })
  }
  if (fee > 0) {
    await addToCartWorkflow(container).run({
      input: {
        cart_id: cartId,
        items: [
          {
            title: "Kapıda ödeme ücreti",
            quantity: 1,
            unit_price: toMedusaAmount(fee),
            is_tax_inclusive: true,
            is_discountable: false,
            requires_shipping: false,
            metadata: { qt_fee: COD_FEE },
          },
        ],
      },
    })
  }
}

/**
 * Puts the cart's payment fee right for the way to pay chosen, before the
 * payment starts: cash on delivery carries its fee as a line of its own;
 * any other way, none. Runs before the start's cart lock (Medusa's cart
 * workflows take that lock themselves), after the cart is found to be
 * this storefront's and still open. A start that fails later puts the
 * earlier fee back.
 */
export const applyPaymentFeeStep = createStep(
  "payments-apply-payment-fee",
  async (
    input: { cart_id: string; provider_id: string; sales_channel_ids: string[] },
    { container }
  ) => {
    const cart = await readFeeCart(container, input.cart_id)
    if (!cart || !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    if (cart.completed_at) {
      throw new ConflictError("cart.completed")
    }
    const facts = feeFacts(cart)
    const fee =
      input.provider_id === COD_PAYMENT_PROVIDER_ID
        ? await expectedCodFee(container, cart)
        : kurus(0)
    if (feeLinesMatch(facts, fee)) {
      return new StepResponse<{ fee: Kurus }, FeeChange | null>({ fee }, null)
    }
    await setFee(container, input.cart_id, fee)
    return new StepResponse<{ fee: Kurus }, FeeChange | null>(
      { fee },
      { cart_id: input.cart_id, before: facts.fees }
    )
  },
  async (changed, { container }) => {
    if (changed) {
      await setFee(container, changed.cart_id, changed.before)
    }
  }
)

/**
 * Under the cart's lock: the fee lines are still the ones put right
 * before it (a request in between could have changed the cart).
 */
export const checkPaymentFeeStep = createStep(
  "payments-check-payment-fee",
  async (input: { cart_id: string; fee: Kurus }, { container }) => {
    const cart = await readFeeCart(container, input.cart_id)
    if (!feeLinesMatch(feeFacts(cart ?? {}), input.fee)) {
      throw new ValidationError("cash_on_delivery.fee_mismatch")
    }
    return new StepResponse(null)
  }
)
