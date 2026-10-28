import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"
import { customerAddresses, customerConsents } from "../../../../../workflows/messaging/consents"
import type { AdminPostCustomerConsentType } from "./validators"

/**
 * GET /admin/customers/:id/consents (F9.5, adr/0036): whether the customer
 * takes commercial e-mail and SMS, and since when. A recorded read.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ consents: await customerConsents(req.scope, req.params["id"] ?? "") })
}

/**
 * POST /admin/customers/:id/consents: the shop records a consent the
 * customer gave or withdrew outside the storefront (by phone, in the
 * shop). Kept with its history, by whom; the audit log has the request.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCustomerConsentType>,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.params["id"] ?? ""
  const { channel, status, evidence } = req.validatedBody
  const address = (await customerAddresses(req.scope, customerId))[channel]
  if (!address) {
    throw new ValidationError("messaging.no_address", { field: "channel" })
  }
  await req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE).recordConsent({
    channel,
    address,
    status,
    source: "panel",
    customer_id: customerId,
    changed_by: req.auth_context.actor_id || null,
    evidence: evidence ? { note: evidence } : null,
  })
  res.json({ consents: await customerConsents(req.scope, customerId) })
}
