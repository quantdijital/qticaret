import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MEDIA_MODULE } from "../../../../modules/media"
import type MediaModuleService from "../../../../modules/media/service"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

interface VideoSnapshot {
  id: string
  kind: string
  title: string | null
  youtube_id: string | null
}

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

/**
 * A product's videos (adr/0069 §3): each by its id, with its kind, title
 * and YouTube id, before and after. No storage key is written.
 */
async function videosOf(scope: Resolver, productId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "media_videos.id",
      "media_videos.kind",
      "media_videos.title",
      "media_videos.youtube_id",
    ],
    filters: { id: productId },
  })
  const videos = (data[0] as { media_videos?: (VideoSnapshot | null)[] | null } | undefined)
    ?.media_videos
  return Object.fromEntries(
    (videos ?? []).flatMap((video) =>
      video
        ? [[video.id, { kind: video.kind, title: video.title, youtube_id: video.youtube_id }]]
        : []
    )
  )
}

async function videoOf(scope: Resolver, productId: string, videoId: string): Promise<Snapshot> {
  const all = await videosOf(scope, productId)
  return Object.hasOwn(all, videoId) ? { [videoId]: all[videoId] } : {}
}

/** A video's state and the failure it shows: what "Yeniden dene" changes. */
async function videoStateOf(
  scope: Resolver,
  productId: string,
  videoId: string
): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product",
    fields: ["media_videos.id", "media_videos.status", "media_videos.error_code"],
    filters: { id: productId },
  })
  const videos = (
    data[0] as
      | { media_videos?: ({ id: string; status: string; error_code: string | null } | null)[] }
      | undefined
  )?.media_videos
  const video = (videos ?? []).find((each) => each?.id === videoId)
  return video ? { [videoId]: { status: video.status, error_code: video.error_code } } : {}
}

export const MEDIA_RESOURCES: readonly AuditedResource[] = [
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/media/:id`,
    pattern: new RegExp(`^/admin/media/(?<id>${ID})$`, "i"),
    resourceType: "media_asset",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      imageOf(scope, params["id"] ?? ""),
  })),
  // The new video's id comes from the handler (`AUDIT_RESOURCE_ID`)
  {
    method: "POST",
    route: "POST /admin/products/:id/videos",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/videos$`, "i"),
    resourceType: "media_video",
    resourceId: () => null,
    snapshot: ({ scope, params }) => videosOf(scope, params["id"] ?? ""),
  },
  // Slice 3: a title changed (before and after), and "Yeniden dene" (its state, before and after)
  {
    method: "POST",
    route: "POST /admin/products/:id/videos/:video_id",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/videos/(?<video_id>${ID})$`, "i"),
    resourceType: "media_video",
    resourceId: (params) => params["video_id"] ?? null,
    snapshot: ({ scope, params }) => videoOf(scope, params["id"] ?? "", params["video_id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/videos/:video_id/retry",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/videos/(?<video_id>${ID})/retry$`, "i"),
    resourceType: "media_video",
    resourceId: (params) => params["video_id"] ?? null,
    snapshot: ({ scope, params }) =>
      videoStateOf(scope, params["id"] ?? "", params["video_id"] ?? ""),
  },
  {
    method: "DELETE",
    route: "DELETE /admin/products/:id/videos/:video_id",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/videos/(?<video_id>${ID})$`, "i"),
    resourceType: "media_video",
    resourceId: (params) => params["video_id"] ?? null,
    snapshot: ({ scope, params }) => videoOf(scope, params["id"] ?? "", params["video_id"] ?? ""),
  },
]
