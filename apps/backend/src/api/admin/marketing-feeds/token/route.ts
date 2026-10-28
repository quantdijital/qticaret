import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../../lib/logging"
import { generateFeedsWorkflow } from "../../../../workflows/marketing/feeds"
import {
  issueFeedTokenWorkflow,
  turnFeedsOffWorkflow,
} from "../../../../workflows/marketing/feed-access"

/**
 * POST /admin/marketing-feeds/token: the feeds on, or a new address for
 * them (the old one stops working). The feeds are built in the background.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await issueFeedTokenWorkflow(req.scope).run({ input: { by: req.auth_context.actor_id } })
  void generateFeedsWorkflow(req.scope)
    .run({ input: { trigger: "panel" } })
    .catch((error: unknown) => {
      logger.warn({ event: "marketing_feeds.generate_failed", err: errorSummary(error) })
    })
  res.status(202).json({ issued: true })
}

/** DELETE /admin/marketing-feeds/token: the feeds off; their addresses and files go. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await turnFeedsOffWorkflow(req.scope).run({ input: { by: req.auth_context.actor_id } })
  res.json({ enabled: false })
}
