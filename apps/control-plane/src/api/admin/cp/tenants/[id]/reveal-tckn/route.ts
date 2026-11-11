import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { openTckn } from "../../../../../../lib/tenants/tckn"
import { recordReadFirst } from "../../../../../http/audit"
import { loggerOf } from "../../../../../http/request"
import { tenantParam, tenantsOf } from "../../params"

/**
 * POST /admin/cp/tenants/:id/reveal-tckn (owner, operator, finance,
 * step-up): a sole proprietor's TCKN in the clear, once (adr/0061 §2,
 * §3.5). The read is recorded first and nothing is shown when it cannot
 * be (Ek C4); the answer is never cached. A refusal is recorded by the
 * audit middleware.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const company = await tenantsOf(req).companyOf(tenant.id)
  if (!company?.tckn_sealed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.tckn_none")
  }
  res.setHeader("Cache-Control", "no-store")
  if (!(await recordReadFirst(req))) {
    res.status(503).json({ type: "unavailable", message: "cp.audit_unavailable" })
    return
  }
  try {
    res.json({ tckn: await openTckn(tenant.id, company.tckn_sealed) })
  } catch (error) {
    // A wrong key or a row copied from another shop: said, never shown
    loggerOf(req)?.error(
      `cp.tckn_open_failed ${JSON.stringify({ tenant_id: tenant.id, code: (error as { code?: string }).code ?? null })}`
    )
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.tckn_unreadable")
  }
}
