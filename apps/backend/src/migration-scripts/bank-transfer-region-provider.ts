import type { ExecArgs } from "@medusajs/framework/types"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../scripts/bootstrap/constants"
import { addRegionPaymentProvider } from "../scripts/bootstrap/region-provider"

/**
 * Runs once per shop, on the `db:migrate` that brings bank transfer (F6
 * W1): every region gains it next to the providers it has. It is offered
 * only once the shop turns it on with its account (adr/0029).
 */
export default async function bankTransferRegionProvider({ container }: ExecArgs) {
  await addRegionPaymentProvider(container, BANK_TRANSFER_PAYMENT_PROVIDER_ID)
}
