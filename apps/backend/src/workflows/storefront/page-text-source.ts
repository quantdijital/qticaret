import type { MedusaContainer } from "@medusajs/framework/types"
import { EMPTY_DOC, contentDoc } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { PAGE_ROLES } from "../../lib/storefront/page-roles"
import type { PageRole, RolePage } from "../../lib/storefront/page-roles"
import type { PageTextSource } from "../../lib/storefront/page-text"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { storefrontRolePages } from "./page-roles"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Which roles each content page has on the storefront (adr/0073 Ek
 * 2026-11-19): the contact, payment and shipping pages the storefront
 * section names, by id (else by an old path).
 */
export async function pageRoles(container: Container): Promise<(id: string) => PageRole[]> {
  const values = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("storefront")
  const roles: Record<PageRole, RolePage | null> = await storefrontRolePages(
    container as MedusaContainer,
    values
  )
  return (id) => PAGE_ROLES.filter((role) => roles[role]?.id === id)
}

/** A stored page text as the document schema reads it; one that does not read is none. */
export const storedBody = (body: unknown): ContentDoc => {
  const parsed = contentDoc.safeParse(body)
  return parsed.success ? parsed.data : EMPTY_DOC
}

/**
 * What the content pages' text sections are made from (K1, K3): each
 * page's text (its `body` mirror) and roles, by id. A post or an id no
 * page has is not among them.
 */
export async function pageTextSources(
  container: Container,
  ids: readonly string[]
): Promise<Map<string, PageTextSource>> {
  if (ids.length === 0) {
    return new Map()
  }
  const [entries, rolesOf] = await Promise.all([
    container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentEntries(
        { id: [...new Set(ids)], kind: "page" },
        { select: ["id", "body"], take: null }
      ),
    pageRoles(container),
  ])
  return new Map(
    entries.map((entry) => [
      entry.id,
      { id: entry.id, body: storedBody(entry.body), roles: rolesOf(entry.id) },
    ])
  )
}
