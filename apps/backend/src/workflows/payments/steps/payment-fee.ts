import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { addToCartWorkflow, deleteLineItemsWorkflow } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount, kurus, sumKurus, toMedusaAmount } from "../../../lib/money"
import type { Kurus, MedusaAmount } from "../../../lib/money"
import { COD_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { COD_FEE, codFee, codRefusal } from "../../../lib/payments/cod"
import { cashOnDeliverySettings } from "../../../lib/payments/settings"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CASH_ON_DELIVERY } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

/** What the fee rules read of a cart: its total, its fee lines, its shipping options. */
export const FEE_CART_FIELDS = [
  "total",
  "raw_total",
  "items.id",
  "items.metadata",
  "items.total",
  "items.raw_total",
  "shipping_methods.shipping_option_id",
]

interface FeeCart {
  raw_total?: MedusaAmount
  total?: MedusaAmount
  items?:
    | ({
        id: string
        metadata?: Record<string, unknown> | null
        raw_total?: MedusaAmount
        total?: MedusaAmount
      } | null)[]
    | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

const amountOf = (raw?: MedusaAmount, plain?: MedusaAmount): Kurus =>
  fromMedusaAmount(raw ?? plain ?? 0, { allowRounding: true })

/** The cart's fee lines, and what the cart comes to without them. */
export function feeFacts(cart: FeeCart) {
  const lines = (cart.items ?? []).filter(
    (item): item is NonNullable<typeof item> => item?.metadata?.["qt_fee"] === COD_FEE
  )
  const fees = sumKurus(lines.map((line) => amountOf(line.raw_total, line.total)))
  return {
    lines,
    fees,
    base: kurus(amountOf(cart.raw_total, cart.total) - fees),
    shipping_option_ids: (cart.shipping_methods ?? []).flatMap((method) =>
      method?.shipping_option_id ? [method.shipping_option_id] : []
    ),
  }
}

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

/**
 * Puts the cart's payment fee right for the way to pay chosen, before the
 * payment starts: cash on delivery carries its fee as a line of its own;
 * any other way, none. Runs before the start's cart lock: Medusa's cart
 * workflows take that lock themselves. A cart changed in between is caught
 * when it is completed (the fee is worked out again there).
 */
export const applyPaymentFeeStep = createStep(
  "payments-apply-payment-fee",
  async (input: { cart_id: string; provider_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: FEE_CART_FIELDS,
      filters: { id: input.cart_id },
    })
    const cart = (data[0] ?? {}) as FeeCart
    const facts = feeFacts(cart)
    const fee =
      input.provider_id === COD_PAYMENT_PROVIDER_ID
        ? await expectedCodFee(container, cart)
        : kurus(0)
    const kept = facts.lines.length === (fee > 0 ? 1 : 0) && facts.fees === fee
    if (!kept) {
      if (facts.lines.length > 0) {
        await deleteLineItemsWorkflow(container).run({
          input: { cart_id: input.cart_id, ids: facts.lines.map((line) => line.id) },
        })
      }
      if (fee > 0) {
        await addToCartWorkflow(container).run({
          input: {
            cart_id: input.cart_id,
            items: [
              {
                title: "Kapıda ödeme ücreti",
                quantity: 1,
                unit_price: toMedusaAmount(fee),
                is_tax_inclusive: true,
                requires_shipping: false,
                metadata: { qt_fee: COD_FEE },
              },
            ],
          },
        })
      }
    }
    return new StepResponse({ fee })
  }
)
