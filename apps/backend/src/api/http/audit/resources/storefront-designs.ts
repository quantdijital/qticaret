import { storedSettings } from "../../../../lib/storefront/layout-settings"
import { STOREFRONT_LAYOUT_MODULE } from "../../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../../modules/storefront-layout/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { draftSnapshot } from "./storefront-layout"

/**
 * The saved looks (adr/0011, adr/0064 §6): each change by what it changes.
 * A save by how many looks of each kind there are (the made one's id is
 * the handler's note); a rename and a removal by the look's kind and name;
 * an apply by the draft's theme and menu set (as a restore) and the look
 * the draft names. A look's document is never written here.
 */

const designs = (scope: Resolver) =>
  scope.resolve(STOREFRONT_LAYOUT_MODULE) as StorefrontLayoutModuleService

const PATH_ID = "(?<id>sfd_[0-9A-Za-z]{1,40})"

async function counts(scope: Resolver): Promise<Snapshot> {
  const rows = await designs(scope).listStorefrontDesigns({}, { select: ["kind"], take: null })
  return {
    "designs.saved": rows.filter((row) => row.kind === "saved").length,
    "designs.auto": rows.filter((row) => row.kind === "auto").length,
  }
}

async function design(scope: Resolver, id: string): Promise<Snapshot> {
  const [row] = await designs(scope).listStorefrontDesigns(
    { id },
    { select: ["kind", "name"], take: 1 }
  )
  return row ? { kind: row.kind, name: row.name ?? null } : {}
}

async function applied(scope: Resolver): Promise<Snapshot> {
  const [row] = await designs(scope).listStorefrontLayouts({}, { take: 1, select: ["id", "draft"] })
  const mark = row ? storedSettings(row.draft).design : null
  return {
    ...(await draftSnapshot(scope)),
    "design.id": mark?.id ?? null,
    ...(await counts(scope)),
  }
}

export const STOREFRONT_DESIGN_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/storefront-designs",
    pattern: /^\/admin\/storefront-designs$/i,
    resourceType: "storefront_design",
    resourceId: () => null,
    snapshot: ({ scope }) => counts(scope),
  },
  {
    method: "POST",
    route: "POST /admin/storefront-designs/:id",
    pattern: new RegExp(`^/admin/storefront-designs/${PATH_ID}$`, "i"),
    resourceType: "storefront_design",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => design(scope, params["id"] ?? ""),
  },
  {
    method: "DELETE",
    route: "DELETE /admin/storefront-designs/:id",
    pattern: new RegExp(`^/admin/storefront-designs/${PATH_ID}$`, "i"),
    resourceType: "storefront_design",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => design(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/storefront-designs/:id/apply",
    pattern: new RegExp(`^/admin/storefront-designs/${PATH_ID}/apply$`, "i"),
    resourceType: "storefront_design",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope }) => applied(scope),
  },
]
