import type { ExecArgs } from "@medusajs/framework/types"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../scripts/bootstrap/constants"
import { addRegionPaymentProvider } from "../scripts/bootstrap/region-provider"

/**
 * Runs once per shop, on the `db:migrate` that brings PayTR (F5 V2): every
 * region gains PayTR next to the providers it has. Without a stored
 * account PayTR refuses to start a payment.
 */
export default async function paytrRegionProvider({ container }: ExecArgs) {
  await addRegionPaymentProvider(container, PAYTR_PAYMENT_PROVIDER_ID)
}
