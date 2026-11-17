import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A product's videos (adr/0069 §10): uploaded clips made fit for the web on the server. */

export const PRODUCT_VIDEOS_FLAG = "catalog.product_videos"

export type VideoStatus = "uploaded" | "processing" | "ready" | "failed"

export interface ProductVideo {
  id: string
  kind: "upload" | "youtube"
  status: VideoStatus
  title: string | null
  position: number
  width: number | null
  height: number | null
  duration_ms: number | null
  outputs: {
    mp4?: { url: string; bytes: number }
    webm?: { url: string; bytes: number }
  } | null
  poster: { url: string; width: number; height: number } | null
  youtube_id: string | null
  /** An i18n key (`video.processing_failed`) while `failed`. */
  error_code: string | null
  /** "Yeniden dene" would take it: the infrastructure failed it and its file is still kept. */
  retryable?: boolean
  created_at: string
}

export interface ProductVideos {
  videos: ProductVideo[]
  /** Videos a product may have (two). */
  limit: number
  /** Whether a clip can be uploaded at all; never why not (that is the server's log). */
  upload: boolean
}

// The server's checks, before the bytes are sent (it reads them again)
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.qt,.webm"
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"])
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|qt|webm)$/i
// While a clip waits or is being made, the list is read again this often
export const VIDEO_POLL_MS = 5000

/**
 * Whether a picked file goes to the video route: MP4, MOV or WebM by its
 * type or, when the browser names none, its extension. A GIF stays an
 * image (adr/0069 slice 7 brings it to video).
 */
export function isVideoFile(file: Pick<File, "name" | "type">): boolean {
  if (VIDEO_TYPES.has(file.type)) {
    return true
  }
  // A type the browser does not know (some MOV and WebM files): the name says
  const untyped = file.type === "" || file.type === "application/octet-stream"
  return untyped && VIDEO_EXTENSION.test(file.name)
}

/** Files split by where they go: the picture route or the video route. */
export function splitMedia(files: File[]): { images: File[]; videos: File[] } {
  return {
    images: files.filter((file) => !isVideoFile(file)),
    videos: files.filter((file) => isVideoFile(file)),
  }
}

/** Whether the job still has work on any of them: the list is read again until it has none. */
export const videosPending = (videos: Pick<ProductVideo, "status">[] | undefined) =>
  (videos ?? []).some((video) => video.status === "uploaded" || video.status === "processing")

/** The list's refresh: every 5 s while a clip waits or is processed, never otherwise. */
export const videoPollInterval = (data: ProductVideos | undefined): number | false =>
  videosPending(data?.videos) ? VIDEO_POLL_MS : false

export const productVideosKey = (productId: string) => ["products", "videos", productId] as const

export const productVideosQuery = (productId: string, enabled = true) =>
  queryOptions({
    queryKey: productVideosKey(productId),
    queryFn: () =>
      sdk.client.fetch<ProductVideos>(`/admin/products/${encodeURIComponent(productId)}/videos`),
    enabled,
    refetchInterval: (query) => videoPollInterval(query.state.data),
  })

const videoPath = (productId: string, videoId: string) =>
  `/admin/products/${encodeURIComponent(productId)}/videos/${encodeURIComponent(videoId)}`

/** The list read again after a change (and the job's polling picks it up from there). */
export function useVideosChanged(productId: string) {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: productVideosKey(productId) })
}

export function useVideoTitle(productId: string) {
  const changed = useVideosChanged(productId)
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string | null }) =>
      sdk.client.fetch<{ video: ProductVideo }>(videoPath(productId, id), {
        method: "POST",
        body: { title },
      }),
    onSettled: changed,
  })
}

export function useRetryVideo(productId: string) {
  const changed = useVideosChanged(productId)
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ video: ProductVideo }>(`${videoPath(productId, id)}/retry`, {
        method: "POST",
        body: {},
      }),
    onSettled: changed,
  })
}

export function useRemoveVideo(productId: string) {
  const changed = useVideosChanged(productId)
  return useMutation({
    mutationFn: (id: string) => sdk.client.fetch(videoPath(productId, id), { method: "DELETE" }),
    onSettled: changed,
  })
}
