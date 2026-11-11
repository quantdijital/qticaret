import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createPackageWorkflow } from "../../../../workflows/plans/packages"
import { noteAuditChanges, noteAuditResource } from "../../../http/audit"
import { plansOf } from "../tenants/params"
import type { PostPlanType } from "./validators"

/**
 * GET /admin/cp/plans (all staff): every package, archived ones too, with
 * its limits and how many shops are on it, cheapest first.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = plansOf(req)
  const [packages, counts] = await Promise.all([service.packages(), service.tenantCounts()])
  res.json({
    plans: packages.map((each) => ({ ...each, tenant_count: counts.get(each.id) ?? 0 })),
  })
}

/**
 * POST /admin/cp/plans (owner, finance): a new package: its code (fixed
 * once made), name, price in kuruş per period, trial and grace days and
 * limits (null for none; a key left out has none).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostPlanType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createPackageWorkflow(req.scope).run({ input: req.validatedBody })
  noteAuditResource(req, result.id)
  noteAuditChanges(req, {
    code: { to: req.validatedBody.code },
    price: { to: req.validatedBody.price },
    period: { to: req.validatedBody.period },
  })
  res.json({ plan: await plansOf(req).packageOf(result.id) })
}
