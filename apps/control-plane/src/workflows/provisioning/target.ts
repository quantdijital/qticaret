import type { MedusaContainer } from "@medusajs/framework/types"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import type { ProvisionTarget } from "../../lib/provisioning/provisioner"
import { publishedKeys } from "../../lib/vault/signing"
import type { TenantRecord } from "../../modules/tenants/types"
import { provisioningIn, tenantsIn } from "../modules"

type Container = Pick<MedusaContainer, "resolve">

export interface StepContext {
  tenant: TenantRecord
  target: ProvisionTarget
}

/**
 * What a step works on, read afresh each time (a step may run again): the
 * shop, its port from its runs, the control plane's published keys. No
 * port yet: `provisioning.no_port` (the first step gives one).
 */
export async function contextOf(container: Container, tenantId: string): Promise<StepContext> {
  const tenant = await tenantsIn(container).tenantOf(tenantId)
  const port = await provisioningIn(container).portOf(tenantId)
  if (port === null) {
    throw new ProvisioningError("provisioning.no_port")
  }
  const keys = await publishedKeys(container)
  if (keys.env_value === "") {
    throw new ProvisioningError("provisioning.no_signing_key")
  }
  return {
    tenant,
    target: { tenant_id: tenant.id, slug: tenant.slug, port, public_keys: keys.env_value },
  }
}
