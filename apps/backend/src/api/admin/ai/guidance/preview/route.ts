import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewGuidanceWorkflow } from "../../../../../workflows/ai/preview-guidance"
import type { AdminPostAiGuidancePreviewType } from "../../validators"

/**
 * POST /admin/ai/guidance/preview (adr/0074 §2, "Dene"): one product's
 * suggestion for a task twice, without the shop's writing guidance and
 * with the guidance as the settings form holds it (cleaned by the
 * section's schema, not saved). Owner and admin (`permission-rules.ts`);
 * within the text budget; each call counts and is recorded as a
 * suggestion's would be, and nothing is kept as a suggestion or written
 * to the product.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiGuidancePreviewType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await previewGuidanceWorkflow(req.scope).run({
    input: {
      task: body.task,
      product_id: body.product_id,
      service: body.service,
      guidance: body.guidance,
      user_id: req.auth_context.actor_id,
    },
  })
  res.json({ preview: result })
}
