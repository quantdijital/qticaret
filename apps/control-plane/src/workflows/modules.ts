import type { MedusaContainer } from "@medusajs/framework/types"
import { FLEET_MODULE } from "../modules/fleet"
import type FleetModuleService from "../modules/fleet/service"
import { PLANS_MODULE } from "../modules/plans"
import type PlansModuleService from "../modules/plans/service"
import { PROVISIONING_MODULE } from "../modules/provisioning"
import type ProvisioningModuleService from "../modules/provisioning/service"
import { TENANTS_MODULE } from "../modules/tenants"
import type TenantsModuleService from "../modules/tenants/service"
import { VAULT_MODULE } from "../modules/vault"
import type VaultModuleService from "../modules/vault/service"

type Container = Pick<MedusaContainer, "resolve">

export const tenantsIn = (container: Container) =>
  container.resolve<TenantsModuleService>(TENANTS_MODULE)

export const plansIn = (container: Container) => container.resolve<PlansModuleService>(PLANS_MODULE)

export const vaultIn = (container: Container) => container.resolve<VaultModuleService>(VAULT_MODULE)

export const fleetIn = (container: Container) => container.resolve<FleetModuleService>(FLEET_MODULE)

export const provisioningIn = (container: Container) =>
  container.resolve<ProvisioningModuleService>(PROVISIONING_MODULE)
