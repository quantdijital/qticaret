import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../../../../lib/logging"
import { BILLING_PROFILE_MODULE } from "../../../../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../../../../modules/billing-profile/service"
import { auditContext, auditService } from "../../../../../http/audit/context"
import { rejectRequest } from "../../../../../http/reject"

/**
 * POST /admin/customers/:id/billing-profile/reveal (F12.6, adr/0040 §3):
 * a customer's full tax id, for an invoice by hand. Owner and admin (the
 * role table), proved again in the request (`requireReauth`), and recorded
 * against the customer first: no record, no number (adr/0009, docs/04).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "billing_profile.id", "billing_profile.tax_id_kind"],
    filters: { id: customerId },
  })
  const profile = (
    data[0] as { billing_profile?: { id: string; tax_id_kind: string } | null } | undefined
  )?.billing_profile
  if (!profile) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "billing_profile.unknown")
  }
  try {
    await auditService(req).record({
      kind: "sensitive_read",
      action: "POST /admin/customers/:id/billing-profile/reveal",
      resource_type: "customer",
      resource_id: customerId,
      changes: { field: "tax_id", kind: profile.tax_id_kind },
      ...auditContext(req),
    })
  } catch (error) {
    logger.error({
      event: "audit.write_failed",
      action: "billing_profile.reveal",
      err: errorSummary(error),
    })
    rejectRequest(
      req,
      res,
      503,
      { type: "temporarily_unavailable", message: "errors.temporarily_unavailable" },
      "audit_unavailable"
    )
    return
  }
  const taxId = await req.scope
    .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    .revealTaxId(profile.id, customerId)
  // Not to be kept by a cache on the way
  res.setHeader("cache-control", "no-store")
  res.json({ tax_id: taxId, kind: profile.tax_id_kind })
}
