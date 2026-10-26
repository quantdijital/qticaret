import { MEDIA_MODULE } from "../../../../modules/media"
import type MediaModuleService from "../../../../modules/media/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/** An image's alt text (F3.3, adr/0011): search-facing text, before and after, like a share image's. */
async function altOf(scope: Resolver, id: string): Promise<Snapshot> {
  const media = scope.resolve(MEDIA_MODULE) as MediaModuleService
  const [asset] = await media.listMediaAssets({ id }, { select: ["alt", "url"], take: 1 })
  return asset ? { alt: asset.alt, url: asset.url } : {}
}

export const MEDIA_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/media/:id",
    pattern: new RegExp(`^/admin/media/(?<id>${ID})$`, "i"),
    resourceType: "media_asset",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => altOf(scope, params["id"] ?? ""),
  },
]
