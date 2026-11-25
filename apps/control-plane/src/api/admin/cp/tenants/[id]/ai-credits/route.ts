import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { walletAsStaff } from "../../../../../../lib/ai-credits/staff"
import { tenantParam } from "../../../tenants/params"
import { staffNames } from "../../../tenants/views"
import type { GetAiWalletType } from "../../../ai/validators"

/**
 * GET /admin/cp/tenants/:id/ai-credits (owner; adr/0085 §5): the shop's
 * wallet as it stands now (its month rolled, bought credits past their
 * day expired, like any read), its own day's cap and its ledger newest
 * first, 50 rows a page. P3d, so the screen needs no other route: whether
 * the shop's plan has `ai.platform_credits` on (`flag_on`, whatever its
 * status), its status, its month's whole grant (`monthly_grant`) and, on
 * each ledger row, the staff member's name beside their id (`actor_name`;
 * null for the system, the shop, or a member since removed).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAiWalletType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { limit, offset } = req.validatedQuery
  const wallet = await walletAsStaff(req.scope, tenant.id, { limit, offset }, new Date())
  const names = await staffNames(
    req,
    wallet.ledger.rows.map((row) => row.actor).filter((actor) => actor.startsWith("user_"))
  )
  res.setHeader("Cache-Control", "no-store")
  res.json({
    balance: wallet.balance,
    own_daily_cap: wallet.ownDailyCap,
    flag_on: wallet.flagOn,
    tenant_status: tenant.status,
    monthly_grant: wallet.monthlyGrant,
    entries: wallet.ledger.rows.map((row) => ({ ...row, actor_name: names[row.actor] ?? null })),
    count: wallet.ledger.count,
    limit,
    offset,
  })
}
