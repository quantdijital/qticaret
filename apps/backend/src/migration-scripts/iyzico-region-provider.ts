import type { ExecArgs } from "@medusajs/framework/types"
import { IYZICO_PAYMENT_PROVIDER_ID } from "../scripts/bootstrap/constants"
import { addRegionPaymentProvider } from "../scripts/bootstrap/region-provider"

/**
 * Runs once per shop, on the `db:migrate` that brings iyzico (F5 V9): every
 * region gains iyzico next to the providers it has. Without a stored
 * account iyzico refuses to start a payment.
 */
export default async function iyzicoRegionProvider({ container }: ExecArgs) {
  await addRegionPaymentProvider(container, IYZICO_PAYMENT_PROVIDER_ID)
}
