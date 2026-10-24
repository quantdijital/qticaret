import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { deleteCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type BillingProfileModuleService from "../../modules/billing-profile/service"

interface DeletedProfileLink {
  customerId: string
  profileId: string
}

/**
 * Medusa's customer deletion does not remove module links, so the link's
 * deleteCascade never fires. Delete the billing profile here so no tax id
 * outlives its customer (adr/0009, KVKK). Soft delete, like the customer.
 */
deleteCustomersWorkflow.hooks.customersDeleted(
  async ({ ids }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "billing_profile.id"],
      filters: { id: ids },
      withDeleted: true,
    })
    const links: DeletedProfileLink[] = data.flatMap((customer) =>
      customer.billing_profile
        ? [{ customerId: customer.id, profileId: customer.billing_profile.id }]
        : []
    )
    if (links.length === 0) {
      return new StepResponse(undefined, [])
    }

    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    await service.softDeleteBillingProfiles(links.map((link) => link.profileId))
    await container.resolve(ContainerRegistrationKeys.LINK).dismiss(links.map(toLinkDefinition))
    return new StepResponse(undefined, links)
  },
  async (links, { container }) => {
    if (!links?.length) {
      return
    }
    const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    await service.restoreBillingProfiles(links.map((link) => link.profileId))
    await container.resolve(ContainerRegistrationKeys.LINK).create(links.map(toLinkDefinition))
  }
)

function toLinkDefinition(link: DeletedProfileLink) {
  return {
    [Modules.CUSTOMER]: { customer_id: link.customerId },
    [BILLING_PROFILE_MODULE]: { billing_profile_id: link.profileId },
  }
}
