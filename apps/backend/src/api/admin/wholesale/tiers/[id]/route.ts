import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { percentToBps } from "../../../../../lib/wholesale"
import { queueWholesaleSync } from "../../../../../workflows/wholesale/queue"
import { deleteTierWorkflow, updateTierWorkflow } from "../../../../../workflows/wholesale/tiers"
import type { AdminUpdateWholesaleTierType } from "../../validators"
import { tierOf, tierView } from "../../view"

/** `GET /admin/wholesale/tiers/:id`: one level. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ tier: tierView(await tierOf(req)) })
}

/** `POST /admin/wholesale/tiers/:id`: renamed, a new rate (written again) or a new minimum. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateWholesaleTierType>,
  res: MedusaResponse
): Promise<void> {
  const { id } = await tierOf(req)
  const body = req.validatedBody
  const { result } = await updateTierWorkflow(req.scope).run({
    input: {
      id,
      name: body.name,
      rate_bps:
        body.percent === undefined
          ? undefined
          : body.percent === null
            ? null
            : percentToBps(body.percent),
      min_quantity: body.min_quantity,
    },
  })
  if (result.rate_changed) {
    await queueWholesaleSync(req.scope, req.auth_context.actor_id || null)
  }
  res.json({ tier: tierView(result.tier) })
}

/** `DELETE /admin/wholesale/tiers/:id`: a level no wholesaler is on, with its group and list. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = await tierOf(req)
  await deleteTierWorkflow(req.scope).run({ input: { id } })
  res.json({ id, deleted: true })
}
