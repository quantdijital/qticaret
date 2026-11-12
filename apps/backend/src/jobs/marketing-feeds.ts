import type { MedusaContainer } from "@medusajs/framework/types"
import { planModeFor } from "../lib/plan-guard"
import { generateFeedsWorkflow } from "../workflows/marketing/feeds"

/**
 * The shop's product feeds built again from its catalog (F10.8, adr/0038
 * §3): Google and Meta fetch them on their own schedule, so prices and
 * stock are at most two hours behind the pages'. Not while the shop is
 * suspended (adr/0061 Ek C19 L1, as `google-merchant-sync`): its
 * storefront answers 503 and the feed route too; the next run once it is
 * open builds them again.
 */
export default async function marketingFeeds(container: MedusaContainer) {
  if ((await planModeFor(container)) === "suspended") {
    return
  }
  await generateFeedsWorkflow(container).run({ input: { trigger: "schedule" } })
}

export const config = {
  name: "marketing-feeds",
  schedule: "15 */2 * * *",
}
