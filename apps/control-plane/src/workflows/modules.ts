import type { MedusaContainer } from "@medusajs/framework/types"
import { PLANS_MODULE } from "../modules/plans"
import type PlansModuleService from "../modules/plans/service"
import { TENANTS_MODULE } from "../modules/tenants"
import type TenantsModuleService from "../modules/tenants/service"

type Container = Pick<MedusaContainer, "resolve">

export const tenantsIn = (container: Container) =>
  container.resolve<TenantsModuleService>(TENANTS_MODULE)

export const plansIn = (container: Container) => container.resolve<PlansModuleService>(PLANS_MODULE)
