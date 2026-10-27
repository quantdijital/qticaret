import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { toMedusaAmount } from "../../../../lib/money"
import type { feeFacts } from "../../../../workflows/payments/steps/payment-fee"
import { FEE_CART_FIELDS, expectedCodFee } from "../../../../workflows/payments/steps/payment-fee"
import type { StoreGetPaymentMethodsType } from "./validators"
import { CARD_PROVIDER_IDS, connectedCardProviders } from "../../../../lib/payments/card-providers"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../../../lib/payments/checkout"
import { bankTransferSettings } from "../../../../lib/payments/settings"
import { formatIban } from "../../../../lib/tr/iban"

/**
 * GET /store/payment/methods (F5 V10, F6): the ways a storefront can start
 * a payment with (`POST /store/carts/:id/payment-session`). Card providers
 * with a stored account, the shop's choice first; bank transfer with the
 * shop's account when it is on. Medusa's own list names every provider the
 * region has, set up or not.
 */
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreGetPaymentMethodsType>,
  res: MedusaResponse
) => {
  const [providers, bank, cod] = await Promise.all([
    connectedCardProviders(req.scope),
    bankTransferSettings(req.scope),
    req.validatedQuery.cart_id
      ? cashOnDeliveryFor(
          req.scope,
          req.validatedQuery.cart_id,
          req.publishable_key_context.sales_channel_ids
        )
      : null,
  ])
  res.json({
    card_providers: providers.map((provider) => CARD_PROVIDER_IDS[provider]),
    bank_transfer:
      bank.enabled && bank.iban
        ? {
            provider_id: BANK_TRANSFER_PAYMENT_PROVIDER_ID,
            account_holder: bank.account_holder,
            bank_name: bank.bank_name,
            iban: formatIban(bank.iban),
            deadline_hours: bank.deadline_hours,
          }
        : null,
    cash_on_delivery: cod,
  })
}

/** Cash on delivery for a cart the storefront can see, with its fee; null when not offered. */
async function cashOnDeliveryFor(
  container: MedusaContainer,
  cartId: string,
  salesChannelIds: readonly string[]
): Promise<{ provider_id: string; fee: string } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["sales_channel_id", ...FEE_CART_FIELDS],
    filters: { id: cartId },
  })
  const cart = data[0] as
    ({ sales_channel_id?: string | null } & Parameters<typeof feeFacts>[0]) | undefined
  if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  try {
    const fee = await expectedCodFee(container, cart)
    return { provider_id: COD_PAYMENT_PROVIDER_ID, fee: toMedusaAmount(fee) }
  } catch {
    return null
  }
}
