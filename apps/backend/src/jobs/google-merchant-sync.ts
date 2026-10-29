import type { MedusaContainer } from "@medusajs/framework/types"
import { syncMerchantProductsWorkflow } from "../workflows/google/merchant"

/**
 * The shop's products sent to its Merchant Center (F10 M13, adr/0038 §3):
 * only what changed since the last run, so a quiet catalog costs a few calls.
 */
export default async function googleMerchantSync(container: MedusaContainer) {
  await syncMerchantProductsWorkflow(container).run({ input: { trigger: "schedule" } })
}

export const config = {
  name: "google-merchant-sync",
  schedule: "45 */2 * * *",
}
