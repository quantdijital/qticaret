import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"
import type { AdminPostCustomerConsentType } from "./validators"

/** Where a customer's messages go: their e-mail, their phone. */
async function addressesOf(container: MedusaContainer, customerId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["email", "phone"],
    filters: { id: customerId },
  })
  const customer = data[0] as { email: string | null; phone: string | null } | undefined
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
  return { email: customer.email, sms: customer.phone }
}

async function consentsOf(container: MedusaContainer, customerId: string) {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const addresses = await addressesOf(container, customerId)
  const read = (channel: "email" | "sms") => {
    const address = addresses[channel]
    return address ? messaging.consentRecordOf(channel, address) : Promise.resolve(null)
  }
  const [email, sms] = await Promise.all([read("email"), read("sms")])
  return {
    email: { address: addresses.email !== null, consent: email },
    sms: { address: addresses.sms !== null, consent: sms },
  }
}

/**
 * GET /admin/customers/:id/consents (F9.5, adr/0036): whether the customer
 * takes commercial e-mail and SMS, and since when. A recorded read.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ consents: await consentsOf(req.scope, req.params["id"] ?? "") })
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
  const { channel, status } = req.validatedBody
  const address = (await addressesOf(req.scope, customerId))[channel]
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
  })
  res.json({ consents: await consentsOf(req.scope, customerId) })
}
