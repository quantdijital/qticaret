import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { VideoFacts } from "../../lib/seo/jsonld-video"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_VIDEOS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * A product's videos for its structured data (adr/0069 §9): the ready
 * ones the page shows, in gallery order, none while the shop's videos are
 * off (§12). Read from the record itself, never through the Store API's
 * leaves: the storefront prints the `seo` object as it is.
 */

export interface VideoRow {
  id: string
  kind?: string | null
  status?: string | null
  title?: string | null
  position?: number | null
  duration_ms?: number | null
  outputs?: { mp4?: { url?: string | null } | null } | null
  poster?: {
    url?: string | null
    derivatives?: {
      srcset?: { webp?: ({ width?: number | null; url?: string | null } | null)[] | null } | null
      og?: { url?: string | null } | null
    } | null
  } | null
  youtube_id?: string | null
  processed_at?: Date | string | null
}

const VIDEO_FIELDS = [
  "media_videos.id",
  "media_videos.kind",
  "media_videos.status",
  "media_videos.title",
  "media_videos.position",
  "media_videos.duration_ms",
  "media_videos.outputs",
  "media_videos.poster",
  "media_videos.youtube_id",
  "media_videos.processed_at",
]

/** An absolute web address of our storage; anything else is not printed. */
function webAddress(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  try {
    const { protocol } = new URL(value)
    return protocol === "https:" || protocol === "http:" ? value : null
  } catch {
    return null
  }
}

/** The poster's widest WebP and its share crop, else the poster itself. */
function thumbnailsOf(poster: VideoRow["poster"]): string[] {
  const widest = [...(poster?.derivatives?.srcset?.webp ?? [])]
    .filter((each) => each !== null)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  const versions = [webAddress(widest?.url), webAddress(poster?.derivatives?.og?.url)].filter(
    (url): url is string => url !== null
  )
  const own = webAddress(poster?.url)
  return versions.length > 0 ? [...new Set(versions)] : own ? [own] : []
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** The ready videos as facts, by their place in the gallery (the record's age breaks a tie). */
export function videoFactsOf(rows: readonly (VideoRow | null)[] | null | undefined): VideoFacts[] {
  return (rows ?? [])
    .filter((row): row is VideoRow => row !== null && row.status === "ready")
    .sort((a, b) => (a.position ?? 1) - (b.position ?? 1) || a.id.localeCompare(b.id))
    .flatMap((row): VideoFacts[] => {
      const base = {
        id: row.id,
        title: row.title ?? null,
        thumbnails: thumbnailsOf(row.poster),
        uploadDate: isoDate(row.processed_at),
      }
      if (row.kind === "youtube") {
        return row.youtube_id ? [{ ...base, kind: "youtube", youtubeId: row.youtube_id }] : []
      }
      if (row.kind === "upload") {
        const contentUrl = webAddress(row.outputs?.mp4?.url)
        return [{ ...base, kind: "upload", contentUrl, durationMs: row.duration_ms ?? null }]
      }
      return []
    })
}

/** The product's ready videos as facts; none while `catalog.product_videos` is off. */
export async function productVideoFacts(
  container: MedusaContainer,
  productId: string
): Promise<VideoFacts[]> {
  const on = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(PRODUCT_VIDEOS)
  if (!on) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: VIDEO_FIELDS,
    filters: { id: productId },
  })
  const row = data[0] as { media_videos?: (VideoRow | null)[] | null } | undefined
  return videoFactsOf(row?.media_videos)
}
