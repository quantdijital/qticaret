import type { MedusaContainer } from "@medusajs/framework/types"
import { STAFF_ROLES_MODULE } from "../../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../../modules/staff-roles/service"
import type { AuditedResource, SnapshotInput } from "../types"

const MEMBER = /^\/admin\/staff\/members\/(?<id>user_[A-Za-z0-9]+)$/i

// The member's role before and after: an owner made shows as `admin` → `owner`
const roleSnapshot = async ({ scope, params }: SnapshotInput) => ({
  role: await (scope as unknown as MedusaContainer)
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .roleOf(params["id"] ?? ""),
})

/** The team (F12.6, adr/0040): who was given which role, and who was taken off. */
export const STAFF_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/staff/members/:id",
    pattern: MEMBER,
    resourceType: "staff_role",
    resourceId: (params) => params["id"] ?? null,
    snapshot: roleSnapshot,
  },
  {
    method: "DELETE",
    route: "DELETE /admin/staff/members/:id",
    pattern: MEMBER,
    resourceType: "staff_role",
    resourceId: (params) => params["id"] ?? null,
    snapshot: roleSnapshot,
  },
]
