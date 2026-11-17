/**
 * A product's videos as structured data (adr/0069 §9): a `VideoObject`
 * node for each ready video the page shows, beside the product's own node
 * in one `@graph`; the product names them in `subjectOf`. No video
 * sitemap: Google leaves a product page's supporting video out of its
 * video results (docs/13 §6).
 */
import { SCHEMA, compact } from "./jsonld-base"
import type { JsonLd } from "./jsonld-base"

/** The most a product page shows (adr/0069 §1: two, uploads and YouTube together). */
export const MAX_PRODUCT_VIDEOS = 2

interface VideoFactsBase {
  /** The video's record id: its node's `@id` is the page's URL and this. */
  id: string
  /** The shop's title; empty: the product's name. */
  title: string | null
  /** Absolute: the poster's widest WebP and its share crop, else the poster itself. */
  thumbnails: string[]
  /** When it became ready, ISO 8601 with its zone; null: not known (no node then). */
  uploadDate: string | null
}

/** A ready video, as the product page shows it (gallery order). */
export type VideoFacts =
  | (VideoFactsBase & {
      kind: "upload"
      /** Our MP4: every browser plays it. */
      contentUrl: string | null
      durationMs: number | null
    })
  | (VideoFactsBase & { kind: "youtube"; youtubeId: string })

/** A YouTube video's id (adr/0069 §8); anything else is not built into an address. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** ISO 8601 duration in whole seconds (`PT12S`), at least one second; none when unknown. */
export function isoDuration(ms: number | null): string | undefined {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    return undefined
  }
  return `PT${String(Math.max(1, Math.round(ms / 1000)))}S`
}

/** The node's own address on the page: stable while the video lives. */
export const videoNodeId = (url: string, id: string): string => `${url}#video-${id}`

/**
 * One video's node, or null when Google's required fields (`name`,
 * `thumbnailUrl`, `uploadDate`) or the thing to play are missing: a
 * broken node is worse than none. `description` is never empty: the
 * caller passes the page's meta description or the product's.
 */
function videoNode(
  video: VideoFacts,
  page: { url: string; name: string; description: string }
): JsonLd | null {
  const own = video.title?.trim() ?? ""
  const name = own || page.name.trim()
  if (!name || video.thumbnails.length === 0 || !video.uploadDate || !page.description) {
    return null
  }
  const played =
    video.kind === "upload"
      ? video.contentUrl
        ? { duration: isoDuration(video.durationMs), contentUrl: video.contentUrl }
        : null
      : YOUTUBE_ID.test(video.youtubeId)
        ? // What Google reads as the player; the page itself plays the privacy-enhanced one
          { embedUrl: `https://www.youtube.com/embed/${video.youtubeId}` }
        : null
  if (!played) {
    return null
  }
  return compact({
    "@type": "VideoObject",
    "@id": videoNodeId(page.url, video.id),
    name,
    description: page.description,
    thumbnailUrl: [...video.thumbnails],
    uploadDate: video.uploadDate,
    ...played,
  })
}

/**
 * The product's block with its videos: the block itself when none can be
 * written (so a video-less product's bytes stay as they were), else one
 * `@graph` of the product's node, naming its videos in `subjectOf`, and
 * theirs.
 */
export function withVideos(
  block: JsonLd,
  videos: readonly VideoFacts[] | undefined,
  page: { url: string; name: string; description: string }
): JsonLd {
  const nodes = (videos ?? [])
    .flatMap((video): JsonLd[] => {
      const node = videoNode(video, page)
      return node ? [node] : []
    })
    .slice(0, MAX_PRODUCT_VIDEOS)
  if (nodes.length === 0) {
    return block
  }
  // The product's own node: the graph carries the context
  const product = Object.fromEntries(Object.entries(block).filter(([key]) => key !== "@context"))
  const links = nodes.map((node) => ({ "@id": node["@id"] }))
  return {
    "@context": SCHEMA,
    "@graph": [{ ...product, subjectOf: links.length === 1 ? links[0] : links }, ...nodes],
  }
}
