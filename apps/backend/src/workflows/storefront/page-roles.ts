import type { MedusaContainer } from "@medusajs/framework/types"
import { roleLookups, rolePages, roleRefs } from "../../lib/storefront/page-roles"
import type { PageRole, RolePage, RoleRef } from "../../lib/storefront/page-roles"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"

const SELECT = ["id", "handle", "status"]

/**
 * The content pages (never posts) the roles name: by id, and by the
 * handles old paths name. A deleted page is not among them.
 */
export async function findRolePages(
  container: MedusaContainer,
  refs: Readonly<Record<PageRole, RoleRef>>
): Promise<RolePage[]> {
  const { ids, handles } = roleLookups(refs)
  const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const [byId, byHandle] = await Promise.all([
    ids.length > 0 ? content.listContentEntries({ kind: "page", id: ids }, { select: SELECT }) : [],
    handles.length > 0
      ? content.listContentEntries({ kind: "page", handle: handles }, { select: SELECT })
      : [],
  ])
  return [...byId, ...byHandle].map((entry) => ({
    id: entry.id,
    handle: entry.handle,
    status: entry.status,
  }))
}

/** Each role's page as the storefront section's values name it now (adr/0073 Açık kararlar 3). */
export async function storefrontRolePages(
  container: MedusaContainer,
  values: Readonly<Record<string, unknown>>
): Promise<Record<PageRole, RolePage | null>> {
  const refs = roleRefs(values)
  return rolePages(refs, await findRolePages(container, refs))
}
