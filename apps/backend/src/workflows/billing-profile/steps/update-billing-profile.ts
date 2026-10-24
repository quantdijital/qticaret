import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type {
  ProtectedProfileData,
  default as BillingProfileModuleService,
} from "../../../modules/billing-profile/service"
import type { StoredBillingProfile } from "../../../modules/billing-profile/types"

const STORED_FIELDS = [
  "type",
  "legal_name",
  "tax_office",
  "tax_id_kind",
  "tax_id_encrypted",
  "tax_id_hash",
  "tax_id_last4",
  "key_version",
] as const

export const updateBillingProfileStep = createStep(
  "billing-profile-update",
  async ({ id, data }: { id: string; data: ProtectedProfileData }, { container }) => {
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    const previous: ProtectedProfileData & { id: string } = await service.retrieveBillingProfile(
      id,
      { select: ["id", ...STORED_FIELDS] }
    )
    const updated = await service.updateBillingProfiles({ id, ...data })
    const profile: StoredBillingProfile = {
      id: updated.id,
      type: updated.type,
      legal_name: updated.legal_name,
      tax_office: updated.tax_office,
      tax_id_kind: updated.tax_id_kind,
      tax_id_last4: updated.tax_id_last4,
    }
    // Compensation restores the previous ciphertext; no plaintext is involved.
    return new StepResponse(profile, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    await service.updateBillingProfiles(previous)
  }
)
