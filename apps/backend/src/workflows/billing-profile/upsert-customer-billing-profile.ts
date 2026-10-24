import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type { BillingProfileInput } from "../../modules/billing-profile/types"
import { toMaskedBillingProfile } from "../../modules/billing-profile/types"
import { createBillingProfileStep } from "./steps/create-billing-profile"
import { updateBillingProfileStep } from "./steps/update-billing-profile"

export type UpsertCustomerBillingProfileInput = BillingProfileInput & { customer_id: string }

/**
 * Creates or replaces a customer's billing profile (F1.5, adr/0009) and
 * returns it masked. The input carries the plaintext tax id, so this
 * workflow must never be configured to store its executions.
 */
export const upsertCustomerBillingProfileWorkflow = createWorkflow(
  "billing-profile-upsert-for-customer",
  (input: UpsertCustomerBillingProfileInput) => {
    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id", "billing_profile.id"],
      filters: { id: input.customer_id },
      options: { throwIfKeyNotFound: true },
    })

    const profileData = transform({ input }, ({ input }): BillingProfileInput => ({
      type: input.type,
      legal_name: input.legal_name,
      tax_office: input.tax_office ?? null,
      tax_id: input.tax_id,
    }))
    const existingId = transform(
      { customers },
      ({ customers }) => customers[0]?.billing_profile?.id ?? null
    )

    const updated = when(
      "billing-profile-exists",
      { existingId },
      ({ existingId }) => !!existingId
    ).then(() => {
      const id = transform({ existingId }, ({ existingId }) => existingId ?? "")
      return updateBillingProfileStep({ id, data: profileData })
    })

    const created = when(
      "billing-profile-missing",
      { existingId },
      ({ existingId }) => !existingId
    ).then(() => {
      const profile = createBillingProfileStep(profileData)
      const links = transform({ input, profile }, ({ input, profile }) => [
        {
          [Modules.CUSTOMER]: { customer_id: input.customer_id },
          [BILLING_PROFILE_MODULE]: { billing_profile_id: profile.id },
        },
      ])
      createRemoteLinkStep(links)
      return profile
    })

    const masked = transform({ updated, created }, ({ updated, created }) => {
      const profile = updated ?? created
      if (!profile) {
        throw new Error("billing profile was neither created nor updated")
      }
      return toMaskedBillingProfile(profile)
    })
    return new WorkflowResponse(masked)
  }
)
