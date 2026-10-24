import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BILLING_PROFILE_MODULE } from "../../../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../../../modules/billing-profile/service"
import type { StoredBillingProfile } from "../../../../../modules/billing-profile/types"
import {
  MASKED_PROFILE_FIELDS,
  toMaskedBillingProfile,
} from "../../../../../modules/billing-profile/types"
import { upsertCustomerBillingProfileWorkflow } from "../../../../../workflows/billing-profile/upsert-customer-billing-profile"
import type { StorePostBillingProfileType } from "./validators"

/** The signed-in customer's billing profile, tax id masked; null when none. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: MASKED_PROFILE_FIELDS.map((field) => `billing_profile.${field}`),
    filters: { id: req.auth_context.actor_id },
  })
  const profile = data[0]?.billing_profile as StoredBillingProfile | null | undefined
  res.json({ billing_profile: profile ? toMaskedBillingProfile(profile) : null })
}

/** Creates or replaces the profile (adr/0009); the response never carries the tax id. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostBillingProfileType>,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.auth_context.actor_id
  // Encrypt where the plaintext enters, so it never reaches workflow storage
  const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
  const data = service.prepareProfileData(req.validatedBody, customerId)

  const { result } = await upsertCustomerBillingProfileWorkflow(req.scope).run({
    input: { customer_id: customerId, data },
  })
  res.json({ billing_profile: result })
}
