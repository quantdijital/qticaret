import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { CARD_PROVIDER_IDS, connectedCardProviders } from "../../../../lib/payments/card-providers"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../../../../lib/payments/checkout"
import { bankTransferSettings } from "../../../../lib/payments/settings"
import { formatIban } from "../../../../lib/tr/iban"

/**
 * GET /store/payment/methods (F5 V10, F6): the ways a storefront can start
 * a payment with (`POST /store/carts/:id/payment-session`). Card providers
 * with a stored account, the shop's choice first; bank transfer with the
 * shop's account when it is on. Medusa's own list names every provider the
 * region has, set up or not.
 */
export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  const [providers, bank] = await Promise.all([
    connectedCardProviders(req.scope),
    bankTransferSettings(req.scope),
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
  })
}
