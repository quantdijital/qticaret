import { PAGE_ID, LAYOUT_LIMITS } from "../../../../lib/storefront/layout"
import { storedSettings } from "../../../../lib/storefront/layout-settings"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { MenuSet } from "../../../../lib/storefront/layout-menus"
import { STOREFRONT_LAYOUT_MODULE } from "../../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../../modules/storefront-layout/service"
import { STOREFRONT_MENUS_MODULE } from "../../../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../../../modules/storefront-menus/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"

/**
 * The storefront design (adr/0011, adr/0063 §3): the theme's settings and
 * the menus now change with a publication and a restored revision. Each is
 * summed up by what it changes: a publication by the live theme (its
 * fields by their path, `theme.colors.primary`) and the shop's menus; a
 * restore by the draft's theme and the menu set it carries; a ready-made
 * look applied (adr/0063 §7) by the same and the preset the draft names.
 * A menu is its place, title and number of links; the links themselves
 * are the menus'.
 */

interface MenuFacts {
  location: string
  title: string
  links: number
}

async function storedRow(scope: Resolver) {
  const service = scope.resolve(STOREFRONT_LAYOUT_MODULE) as StorefrontLayoutModuleService
  const [row] = await service.listStorefrontLayouts(
    {},
    { take: 1, select: ["id", "draft", "published"] }
  )
  return row as { draft: unknown; published: unknown } | undefined
}

function flatten(value: unknown, path: string, into: Snapshot): Snapshot {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value)) {
      flatten(inner, `${path}.${key}`, into)
    }
  } else {
    into[path] = value
  }
  return into
}

// Footers by their order; the header's menu and the top links have one place each
function menuFacts(menus: readonly MenuFacts[]): Snapshot {
  const facts: Snapshot = {}
  let footers = 0
  for (const menu of menus) {
    const key = menu.location === "footer" ? `footer_${String(++footers)}` : menu.location
    facts[`menus.${key}.title`] = menu.title
    facts[`menus.${key}.links`] = menu.links
  }
  return facts
}

async function liveMenus(scope: Resolver): Promise<MenuFacts[]> {
  const service = scope.resolve(STOREFRONT_MENUS_MODULE) as StorefrontMenusModuleService
  const menus = await service.listStorefrontMenus(
    {},
    { select: ["id", "title", "location", "rank"], order: { rank: "ASC" } }
  )
  if (menus.length === 0) {
    return []
  }
  const items = await service.listStorefrontMenuItems(
    { menu_id: menus.map((menu) => menu.id) },
    { select: ["id", "menu_id"] }
  )
  return menus.map((menu) => ({
    location: menu.location,
    title: menu.title,
    links: items.filter((item) => item.menu_id === menu.id).length,
  }))
}

const setFacts = (set: MenuSet): MenuFacts[] =>
  [...set]
    .sort((a, b) => a.rank - b.rank)
    .map((menu) => ({
      location: menu.location,
      title: menu.title,
      links: menu.items.reduce((sum, item) => sum + 1 + item.children.length, 0),
    }))

/** What a publication changes: the live theme (null: the theme section's) and the shop's menus. */
export async function liveSnapshot(scope: Resolver): Promise<Snapshot> {
  const row = await storedRow(scope)
  const theme = row?.published ? storedSettings(row.published).theme : null
  return { ...flatten(theme, "theme", {}), ...menuFacts(await liveMenus(scope)) }
}

/** What a restore changes: the draft's theme and the menu set it would put live (none: `menus`). */
export async function draftSnapshot(scope: Resolver): Promise<Snapshot> {
  const row = await storedRow(scope)
  const settings = row?.draft ? storedSettings(row.draft) : null
  const menus = settings?.menus ? menuFacts(setFacts(settings.menus)) : { menus: null }
  return { ...flatten(settings?.theme ?? null, "theme", {}), ...menus }
}

/** What applying a preset changes: the draft's theme, its menu set and the preset it names. */
export async function presetSnapshot(scope: Resolver): Promise<Snapshot> {
  const row = await storedRow(scope)
  const preset = row?.draft ? storedSettings(row.draft).preset : null
  return { ...(await draftSnapshot(scope)), ...flatten(preset, "preset", {}) }
}

/**
 * The content pages a publication takes live with it (`pages_live`,
 * adr/0073 Ek 2026-11-19 (2) K5): each named page's status by its id, so
 * the record says which went from draft to live. Ids only, never a
 * page's title or text; a malformed id (refused by the route) is left out.
 */
export async function pagesLiveSnapshot(scope: Resolver, body: unknown): Promise<Snapshot> {
  const named =
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as Record<string, unknown>)["pages_live"])
      ? ((body as Record<string, unknown>)["pages_live"] as unknown[])
      : []
  const ids = [
    ...new Set(named.filter((id): id is string => typeof id === "string" && PAGE_ID.test(id))),
  ].slice(0, LAYOUT_LIMITS.pages)
  if (ids.length === 0) {
    return {}
  }
  const entries = await (scope.resolve(CONTENT_MODULE) as ContentModuleService).listContentEntries(
    { id: ids, kind: "page" },
    { select: ["id", "status"], take: null }
  )
  return Object.fromEntries(entries.map((entry) => [`pages_live.${entry.id}.status`, entry.status]))
}

export const STOREFRONT_LAYOUT_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/storefront-layout/publish",
    pattern: /^\/admin\/storefront-layout\/publish$/i,
    resourceType: "storefront_layout",
    resourceId: () => null,
    snapshot: async ({ scope, body }) => ({
      ...(await liveSnapshot(scope)),
      ...(await pagesLiveSnapshot(scope, body)),
    }),
  },
  {
    method: "POST",
    route: "POST /admin/storefront-layout/revisions/:revision/restore",
    pattern: /^\/admin\/storefront-layout\/revisions\/(?<revision>[0-9]+)\/restore$/i,
    resourceType: "storefront_layout",
    resourceId: (params) => params["revision"] ?? null,
    snapshot: ({ scope }) => draftSnapshot(scope),
  },
  {
    method: "POST",
    route: "POST /admin/storefront-presets/:pack/:code/apply",
    pattern: /^\/admin\/storefront-presets\/(?<pack>[a-z0-9-]+)\/(?<code>[a-z0-9-]+)\/apply$/i,
    resourceType: "storefront_layout",
    resourceId: (params) => `${params["pack"] ?? ""}/${params["code"] ?? ""}`,
    snapshot: ({ scope }) => presetSnapshot(scope),
  },
]
