import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { toMedusaAmount } from "../../lib/money"
import { CARD_PROVIDER_IDS, routedCardProviders } from "../../lib/payments/card-providers"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../lib/payments/checkout"
import { bankTransferSettings } from "../../lib/payments/settings"
import { formatIban } from "../../lib/tr/iban"
import { expectedCodFee, readFeeCart } from "./steps/payment-fee"

/** Cash on delivery for a cart the storefront can see, with its fee; null when not offered. */
async function cashOnDeliveryFor(
  container: MedusaContainer,
  cartId: string,
  salesChannelIds: readonly string[]
): Promise<{ provider_id: string; fee: string } | null> {
  const cart = await readFeeCart(container, cartId)
  if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
  }
  try {
    const fee = await expectedCodFee(container, cart)
    return { provider_id: COD_PAYMENT_PROVIDER_ID, fee: toMedusaAmount(fee) }
  } catch (error) {
    // Not offered for this cart (off, over the limit, a courier that does not collect)
    if (error instanceof ValidationError && error.safeMessage.startsWith("cash_on_delivery.")) {
      return null
    }
    throw error
  }
}

/**
 * The ways a storefront can start a payment with (F5 V10, F6): card
 * providers with a stored account, the shop's choice first unless the
 * health check finds it down (then the backup leads); bank transfer with
 * the shop's account when it is on; cash on delivery for the cart asked
 * about. Medusa's own list names every provider the region has, set up or
 * not.
 */
export async function paymentMethods(
  container: MedusaContainer,
  input: { cart_id?: string | undefined; sales_channel_ids: readonly string[] }
) {
  const [providers, bank, cod] = await Promise.all([
    routedCardProviders(container),
    bankTransferSettings(container),
    input.cart_id ? cashOnDeliveryFor(container, input.cart_id, input.sales_channel_ids) : null,
  ])
  return {
    // Healthy first: a provider found down is the last to try (F6.3)
    card_providers: providers.map(({ provider }) => CARD_PROVIDER_IDS[provider]),
    card_providers_down: providers
      .filter(({ healthy }) => !healthy)
      .map(({ provider }) => CARD_PROVIDER_IDS[provider]),
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
  }
}
