import type { ExecArgs } from "@medusajs/framework/types"
import { COD_PAYMENT_PROVIDER_ID } from "../scripts/bootstrap/constants"
import { addRegionPaymentProvider } from "../scripts/bootstrap/region-provider"

/**
 * Runs once per shop, on the `db:migrate` that brings cash on delivery (F6
 * W3): every region gains it. It is offered only with its flag on, within
 * the shop's limit and with a courier that collects (adr/0029).
 */
export default async function codRegionProvider({ container }: ExecArgs) {
  await addRegionPaymentProvider(container, COD_PAYMENT_PROVIDER_ID)
}
