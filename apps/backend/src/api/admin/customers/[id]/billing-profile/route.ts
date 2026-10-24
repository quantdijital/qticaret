import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { StoredBillingProfile } from "../../../../../modules/billing-profile/types"
import {
  MASKED_PROFILE_FIELDS,
  toMaskedBillingProfile,
} from "../../../../../modules/billing-profile/types"

/**
 * Masked billing profile for the customer detail widget (adr/0009). Showing
 * the full tax id needs a permission (F12) and an audit entry (F2.5).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.params["id"]
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "customer id is required")
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", ...MASKED_PROFILE_FIELDS.map((field) => `billing_profile.${field}`)],
    filters: { id: customerId },
  })
  const customer = data[0]
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found")
  }
  const profile = customer.billing_profile as StoredBillingProfile | null | undefined
  res.json({ billing_profile: profile ? toMaskedBillingProfile(profile) : null })
}
