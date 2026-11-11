import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { kekStatus } from "../../../../../lib/vault/kek-status"
import { rewrapSealedWorkflow } from "../../../../../workflows/vault/rewrap"
import { noteAuditChanges } from "../../../../http/audit"
import { loggerOf } from "../../../../http/request"

/**
 * POST /admin/cp/keys/rewrap (owner, step-up): every sealed value under an
 * older configured KEK moved to the current one (adr/0061 §4.1, Ek C8),
 * the same run as `cp:keys rewrap` and the hourly job. Counts back, with
 * where things stand now; which old keys may be removed is `removable`.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await rewrapSealedWorkflow(req.scope).run()
  const status = await kekStatus(req.scope)
  const rewrapped = result.secret_record.rewrapped + result.tenant_company.rewrapped
  const failed = [...result.secret_record.failed_ids, ...result.tenant_company.failed_ids]
  if (failed.length > 0) {
    // Row ids only: a value that did not open is never described
    loggerOf(req)?.error(`cp.rewrap_failed ${JSON.stringify({ ids: failed.slice(0, 50) })}`)
  }
  noteAuditChanges(req, {
    rewrapped: { to: rewrapped },
    failed: { to: failed.length },
    pending: { to: status.pending },
  })
  res.json({ rewrapped, failed: failed.length, status })
}
