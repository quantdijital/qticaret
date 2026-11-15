import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { percentToBps } from "../../../../../lib/wholesale"
import { deletePendingAccountWorkflow } from "../../../../../workflows/wholesale/accounts/remove"
import { updateAccountWorkflow } from "../../../../../workflows/wholesale/accounts/update"
import { queueWholesaleSync } from "../../../../../workflows/wholesale/queue"
import type { AdminUpdateWholesaleAccountType } from "../../account-validators"
import { accountIdOf, accountViewOf } from "../../account-view"

/** `GET /admin/wholesale/accounts/:id`: one wholesaler. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ account: await accountViewOf(req) })
}

/**
 * `POST /admin/wholesale/accounts/:id` (ADR-0068 §3): another level, the
 * own list opened, its rate (written again by the sync job), the fewest
 * units, the company and contact.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateWholesaleAccountType>,
  res: MedusaResponse
): Promise<void> {
  const id = await accountIdOf(req)
  const body = req.validatedBody
  const actor = req.auth_context.actor_id || null
  const { result } = await updateAccountWorkflow(req.scope).run({
    input: {
      id,
      tier_id: body.tier_id,
      own_prices: body.own_prices,
      rate_bps:
        body.percent === undefined
          ? undefined
          : body.percent === null
            ? null
            : percentToBps(body.percent),
      min_quantity: body.min_quantity,
      company_name: body.company_name,
      contact_name: body.contact_name,
      updated_by: actor,
    },
  })
  if (result.rate_changed) {
    await queueWholesaleSync(req.scope, actor)
  }
  res.json({ account: await accountViewOf(req, id) })
}

/** `DELETE /admin/wholesale/accounts/:id`: a pending wholesaler taken back; others are closed. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  await deletePendingAccountWorkflow(req.scope).run({ input: { id } })
  res.json({ id, deleted: true })
}
