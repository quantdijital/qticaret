import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { openTckn } from "../../../../../../lib/tenants/tckn"
import { recordReadFirst } from "../../../../../http/audit"
import { loggerOf } from "../../../../../http/request"
import { tenantParam, tenantsOf } from "../../params"

/**
 * POST /admin/cp/tenants/:id/reveal-tckn (owner, operator, finance,
 * step-up, 20 an hour per member): a sole proprietor's TCKN in the clear,
 * once (adr/0061 §2, §3.5). Opened first, in memory only; then the read
 * is recorded, and only then shown: when it cannot be recorded nothing is
 * shown (503, Ek C4), and a number that cannot be opened leaves no "shown"
 * row (review L1). Never cached. Refusals are recorded by the audit
 * middleware, as reads.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const company = await tenantsOf(req).companyOf(tenant.id)
  if (!company?.tckn_sealed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.tckn_none")
  }
  res.setHeader("Cache-Control", "no-store")
  let tckn: string
  try {
    tckn = await openTckn(tenant.id, company.tckn_sealed)
  } catch (error) {
    // A wrong key or a row copied from another shop: said, never shown
    loggerOf(req)?.error(
      `cp.tckn_open_failed ${JSON.stringify({ tenant_id: tenant.id, code: (error as { code?: string }).code ?? null })}`
    )
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.tckn_unreadable")
  }
  if (!(await recordReadFirst(req))) {
    res.status(503).json({ type: "unavailable", message: "cp.audit_unavailable" })
    return
  }
  res.json({ tckn })
}
