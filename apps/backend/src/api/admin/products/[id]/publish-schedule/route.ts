import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setPublishScheduleWorkflow } from "../../../../../workflows/catalog/publish-schedule"
import type { AdminPostProductPublishScheduleType } from "./validators"

/**
 * A draft's planned publish set or cancelled (S2, docs/06 "Ürün
 * sayfası"); the minute job publishes it when its moment comes. Answers
 * with the plan as stored.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostProductPublishScheduleType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setPublishScheduleWorkflow(req.scope).run({
    input: { product_id: req.params["id"] ?? "", publish_at: req.validatedBody.publish_at },
  })
  res.json({ schedule: result })
}

/** The plan cancelled; the product stays a draft. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await setPublishScheduleWorkflow(req.scope).run({
    input: { product_id: req.params["id"] ?? "", publish_at: null },
  })
  res.json({ schedule: result })
}
