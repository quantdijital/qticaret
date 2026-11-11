import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { platformFlags } from "@qticaret/types/control-plane"
import { createPackageWorkflow } from "../../../../workflows/plans/packages"
import { noteAuditChanges, noteAuditResource } from "../../../http/audit"
import { plansOf } from "../tenants/params"
import type { PostPlanType } from "./validators"

/**
 * GET /admin/cp/plans (all staff): every package, archived ones too, with
 * its limits, flags and how many shops are on it, cheapest first; and the
 * platform flags a package may set.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = plansOf(req)
  const [packages, counts] = await Promise.all([service.packages(), service.tenantCounts()])
  res.json({
    plans: packages.map((each) => ({ ...each, tenant_count: counts.get(each.id) ?? 0 })),
    // The flags a package may set, with their defaults (Ek C9)
    platform_flags: platformFlags(process.env["NODE_ENV"]).map(({ key, default: value }) => ({
      key,
      default: value,
    })),
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
