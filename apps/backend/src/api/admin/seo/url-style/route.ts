import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { planUrlStyle } from "../../../../workflows/seo/url-style"
import type { AdminGetUrlStyleType } from "../redirects/validators"

/**
 * What moving to another URL style would do (docs/13 §2.2): how many
 * pages get a new address and what stands in the way. The move itself is
 * the `seo.url_style` job, which checks again before it starts.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetUrlStyleType>,
  res: MedusaResponse
): Promise<void> {
  const plan = await planUrlStyle(req.scope, req.validatedQuery)
  res.json({
    moves: plan.moves.length,
    conflicts: plan.conflicts,
    skipped: plan.skipped,
  })
}
