import { MEDIA_MODULE } from "../../../../modules/media"
import type MediaModuleService from "../../../../modules/media/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * An image's alt text and library name (F3.3, adr/0011): search-facing text,
 * before and after, like a share image's; a deleted image's last state.
 */
async function imageOf(scope: Resolver, id: string): Promise<Snapshot> {
  const media = scope.resolve(MEDIA_MODULE) as MediaModuleService
  const [asset] = await media.listMediaAssets(
    { id },
    { select: ["alt", "url", "filename"], take: 1 }
  )
  return asset ? { alt: asset.alt, url: asset.url, filename: asset.filename } : {}
}

export const MEDIA_RESOURCES: readonly AuditedResource[] = (["POST", "DELETE"] as const).map(
  (method) => ({
    method,
    route: `${method} /admin/media/:id`,
    pattern: new RegExp(`^/admin/media/(?<id>${ID})$`, "i"),
    resourceType: "media_asset",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }) => imageOf(scope, params["id"] ?? ""),
  })
)
