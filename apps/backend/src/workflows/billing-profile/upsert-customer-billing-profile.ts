import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type { ProtectedProfileData } from "../../modules/billing-profile/service"
import { toMaskedBillingProfile } from "../../modules/billing-profile/types"
import { createBillingProfileStep } from "./steps/create-billing-profile"
import { updateBillingProfileStep } from "./steps/update-billing-profile"

export interface UpsertCustomerBillingProfileInput {
  customer_id: string
  /** Output of BillingProfileModuleService.prepareProfileData; never plaintext. */
  data: ProtectedProfileData
}

/**
 * Creates or replaces a customer's billing profile (F1.5, adr/0009) and
 * returns it masked. The input is already encrypted, so the plaintext tax id
 * never reaches workflow storage. A per-customer lock keeps two concurrent
 * first saves from creating two profiles.
 */
export const upsertCustomerBillingProfileWorkflow = createWorkflow(
  "billing-profile-upsert-for-customer",
  (input: UpsertCustomerBillingProfileInput) => {
    const lockKey = transform({ input }, ({ input }) => `billing-profile:${input.customer_id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 })

    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id", "billing_profile.id"],
      filters: { id: input.customer_id },
      options: { throwIfKeyNotFound: true },
    })
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
      return updateBillingProfileStep({ id, data: input.data })
    })

    const created = when(
      "billing-profile-missing",
      { existingId },
      ({ existingId }) => !existingId
    ).then(() => {
      const profile = createBillingProfileStep(input.data)
      const links = transform({ input, profile }, ({ input, profile }) => [
        {
          [Modules.CUSTOMER]: { customer_id: input.customer_id },
          [BILLING_PROFILE_MODULE]: { billing_profile_id: profile.id },
        },
      ])
      createRemoteLinkStep(links)
      return profile
    })

    releaseLockStep({ key: lockKey })

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
