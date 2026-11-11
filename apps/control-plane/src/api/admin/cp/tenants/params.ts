import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PLANS_MODULE } from "../../../../modules/plans"
import type PlansModuleService from "../../../../modules/plans/service"
import { TENANTS_MODULE } from "../../../../modules/tenants"
import type TenantsModuleService from "../../../../modules/tenants/service"
import type { TenantRecord } from "../../../../modules/tenants/types"
import { cpStaff } from "../../../http/caller"

export const tenantsOf = (req: MedusaRequest) =>
  req.scope.resolve<TenantsModuleService>(TENANTS_MODULE)

export const plansOf = (req: MedusaRequest) => req.scope.resolve<PlansModuleService>(PLANS_MODULE)

/** A path parameter as Express decoded it; 404 when absent or absurd. */
export function paramOf(req: MedusaRequest, name: string): string {
  const value = (req.params as Record<string, string | undefined>)[name] ?? ""
  if (value === "" || value.length > 64) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "errors.not_found")
  }
  return value
}

/** The shop a `:id` route names, or 404 `cp.tenant_unknown`. */
export const tenantParam = (req: MedusaRequest): Promise<TenantRecord> =>
  tenantsOf(req).tenantOf(paramOf(req, "id"))

/** The signed-in staff member's user id (the staff guard has let only one through). */
export const actorOf = (req: MedusaRequest): string =>
  (req as unknown as { auth_context: { actor_id: string } }).auth_context.actor_id

/** Who acts on a note: themselves, and whether they are an owner (any note is theirs to edit). */
export async function noteActor(req: MedusaRequest) {
  const id = actorOf(req)
  return { id, owner: (await cpStaff(req).roleOf(id)) === "owner" }
}
