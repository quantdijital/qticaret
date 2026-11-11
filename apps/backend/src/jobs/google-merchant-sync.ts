import type { MedusaContainer } from "@medusajs/framework/types"
import { planModeFor } from "../lib/plan-guard"
import { syncMerchantProductsWorkflow } from "../workflows/google/merchant"

/**
 * The shop's products sent to its Merchant Center (F10 M13, adr/0038 §3):
 * only what changed since the last run, so a quiet catalog costs a few calls.
 * Not while the shop is suspended (adr/0061 Ek C15, review M1): its
 * storefront answers 503, so no product of it is offered anew; the next run
 * once it is open sends what changed meanwhile.
 */
export default async function googleMerchantSync(container: MedusaContainer) {
  if ((await planModeFor(container)) === "suspended") {
    return
  }
  await syncMerchantProductsWorkflow(container).run({ input: { trigger: "schedule" } })
}

export const config = {
  name: "google-merchant-sync",
  schedule: "45 */2 * * *",
}
