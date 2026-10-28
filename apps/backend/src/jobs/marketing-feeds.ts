import type { MedusaContainer } from "@medusajs/framework/types"
import { generateFeedsWorkflow } from "../workflows/marketing/feeds"

/**
 * The shop's product feeds built again from its catalog (F10.8, adr/0038
 * §3): Google and Meta fetch them on their own schedule, so prices and
 * stock are at most two hours behind the pages'.
 */
export default async function marketingFeeds(container: MedusaContainer) {
  await generateFeedsWorkflow(container).run({ input: { trigger: "schedule" } })
}

export const config = {
  name: "marketing-feeds",
  schedule: "15 */2 * * *",
}
