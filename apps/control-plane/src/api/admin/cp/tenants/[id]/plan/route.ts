import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assignPlanWorkflow } from "../../../../../../workflows/plans/tenant-plan"
import { noteAuditChanges } from "../../../../../http/audit"
import { actorOf, plansOf, tenantParam } from "../../params"
import type { PostTenantPlanType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/plan (owner, operator): the package the shop
 * is on, or none; an archived package takes no new shop
 * (`cp.package_archived`). Recorded from and to by package code.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostTenantPlanType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { package_id } = req.validatedBody
  const { result } = await assignPlanWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, package_id, by: actorOf(req) },
  })
  const ids = [result.from, result.to].filter((id): id is string => id !== null)
  const codes = new Map(
    (ids.length > 0 ? await plansOf(req).packages({ id: ids }) : []).map((each) => [
      each.id,
      each.code,
    ])
  )
  noteAuditChanges(req, {
    package: {
      from: result.from ? (codes.get(result.from) ?? result.from) : null,
      to: result.to ? (codes.get(result.to) ?? result.to) : null,
    },
  })
  res.json({ package_id })
}
