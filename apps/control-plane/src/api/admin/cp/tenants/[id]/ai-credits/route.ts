import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { walletAsStaff } from "../../../../../../lib/ai-credits/staff"
import { tenantParam } from "../../../tenants/params"
import type { GetAiWalletType } from "../../../ai/validators"

/**
 * GET /admin/cp/tenants/:id/ai-credits (owner; adr/0085 §5): the shop's
 * wallet as it stands now (its month rolled, bought credits past their
 * day expired, like any read), its own day's cap and its ledger newest
 * first, 50 rows a page.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAiWalletType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { limit, offset } = req.validatedQuery
  const wallet = await walletAsStaff(req.scope, tenant.id, { limit, offset }, new Date())
  res.setHeader("Cache-Control", "no-store")
  res.json({
    balance: wallet.balance,
    own_daily_cap: wallet.ownDailyCap,
    entries: wallet.ledger.rows,
    count: wallet.ledger.count,
    limit,
    offset,
  })
}
