import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { percentToBps } from "../../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../../modules/wholesale"
import type WholesaleModuleService from "../../../../modules/wholesale/service"
import { queueWholesaleSync } from "../../../../workflows/wholesale/queue"
import { createTierWorkflow } from "../../../../workflows/wholesale/tiers"
import type { AdminGetWholesaleTiersType, AdminPostWholesaleTierType } from "../validators"
import { tierView } from "../view"

/** `GET /admin/wholesale/tiers` (ADR-0068): a page of the shop's wholesale levels, by name. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset } = req.validatedQuery as unknown as AdminGetWholesaleTiersType
  const [tiers, count] = await req.scope
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listAndCountWholesaleTiers({}, { order: { name: "ASC" }, skip: offset, take: limit })
  res.json({ tiers: tiers.map(tierView), count, limit, offset })
}

/** `POST /admin/wholesale/tiers`: a new level; a rate's prices are written by the sync job. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWholesaleTierType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const actor = req.auth_context.actor_id || null
  const { result: tier } = await createTierWorkflow(req.scope).run({
    input: {
      name: body.name,
      rate_bps: body.percent === null ? null : percentToBps(body.percent),
      min_quantity: body.min_quantity,
      created_by: actor,
    },
  })
  if (tier.rate_bps !== null) {
    await queueWholesaleSync(req.scope, actor)
  }
  res.status(201).json({ tier: tierView(tier) })
}
