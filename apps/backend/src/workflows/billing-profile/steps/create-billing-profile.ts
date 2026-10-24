import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../modules/billing-profile/service"
import type {
  BillingProfileInput,
  StoredBillingProfile,
} from "../../../modules/billing-profile/types"

export const createBillingProfileStep = createStep(
  "billing-profile-create",
  async (input: BillingProfileInput, { container }) => {
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    const created = await service.createBillingProfiles(service.prepareProfileData(input))
    const profile: StoredBillingProfile = {
      id: created.id,
      type: created.type,
      legal_name: created.legal_name,
      tax_office: created.tax_office,
      tax_id_kind: created.tax_id_kind,
      tax_id_last4: created.tax_id_last4,
    }
    return new StepResponse(profile, created.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    await service.deleteBillingProfiles(id)
  }
)
