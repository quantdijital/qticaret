import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The media library (`/admin/media`, docs/06 Ortam kütüphanesi). */

export const MEDIA_KEY = ["media"] as const
export const MEDIA_PAGE_SIZE = 24

// What the server takes (docs/04 upload checks); it checks the bytes again
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif"
const ACCEPTED_TYPES = new Set(IMAGE_ACCEPT.split(","))
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
/**
 * An SVG: offered only by the shop's logo and site icon fields (the server
 * cleans it at upload and refuses it anywhere else, `lib/media/svg-use.ts`).
 */
export const SVG_MIME = "image/svg+xml"
export const SVG_ACCEPT = `${IMAGE_ACCEPT},${SVG_MIME}`
export const MAX_SVG_BYTES = 200 * 1024

export const isSvgAsset = (asset: Pick<MediaAsset, "mime_type">) => asset.mime_type === SVG_MIME

export interface MediaAsset {
  id: string
  url: string
  /** The storage key: what a brand's logo and a page's own share image hold. */
  file_id: string | null
  filename: string
  mime_type: string | null
  size: number | null
  width: number | null
  height: number | null
  alt: string | null
  /** Made by an AI service (adr/0071 §5): `edited` from a picture of the shop's. */
  ai_source?: "edited" | "generated" | null
  /** The picture it was made from; that one may have been deleted since. */
  derived_from_id?: string | null
  created_at: string
}

export type MediaUseKind =
  | "product"
  | "product_description"
  | "brand"
  | "content"
  | "landing"
  | "bulk_message"
  | "storefront"
  | "logo"
  | "share_image"
  | "seo"
  | "order"
  /** A category's picture: `id` the category, `label` its name. */
  | "category"
  /** The shop's ETBİS QR code (Settings > Store profile > Legal); no `id`. */
  | "etbis_qr"
  /** The storefront's site icon (Settings > Store profile > General); no `id`. */
  | "favicon"
  /** A saved look (Vitrin > Görünümler): `id` the look, `label` its name (null: automatic). */
  | "storefront_design"
  /** A collection's picture: `id` the collection, `label` its title. */
  | "collection"

export interface MediaUse {
  kind: MediaUseKind
  id: string | null
  label: string | null
}

export interface MediaDetail extends MediaAsset {
  uploaded_by: { id: string; name: string } | null
  usage: MediaUse[]
  /** The original of an AI version while it exists; null when deleted (or not a version). */
  derived_from?: { id: string; url: string; filename: string } | null
}

export const mediaListQuery = ({
  q,
  page,
  limit = MEDIA_PAGE_SIZE,
}: {
  q: string
  page: number
  limit?: number
}) =>
  queryOptions({
    queryKey: [...MEDIA_KEY, "list", { q, page, limit }],
    queryFn: () =>
      sdk.client.fetch<{ media: MediaAsset[]; count: number }>("/admin/media", {
        query: { offset: page * limit, limit, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export const mediaDetailQuery = (id: string) =>
  queryOptions({
    queryKey: [...MEDIA_KEY, "detail", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ media: MediaDetail }>(`/admin/media/${encodeURIComponent(id)}`))
        .media,
  })

/**
 * Why a file cannot go up, before it is sent: its type or its size (the
 * server checks again). An SVG only where `svg` is offered (a logo, the
 * site icon), within its own smaller limit.
 */
export function fileProblem(file: File, svg = false): "type" | "size" | "svgSize" | null {
  if (file.type === SVG_MIME && svg) {
    return file.size > MAX_SVG_BYTES ? "svgSize" : null
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return "type"
  }
  return file.size > MAX_IMAGE_BYTES ? "size" : null
}

/**
 * A file from this computer into the library: uploaded through the checked
 * upload route (cleaned of metadata on the way, F3.3), then kept in the
 * library until deleted there.
 */
export async function uploadToLibrary(file: File): Promise<MediaAsset> {
  const { files } = await sdk.admin.upload.create({ files: [file] })
  const stored = files[0]
  if (!stored) {
    throw new Error("upload returned no file")
  }
  const { media } = await sdk.client.fetch<{ media: MediaAsset[] }>("/admin/media", {
    method: "POST",
    body: { file_ids: [stored.id], library: true },
  })
  const [asset] = media
  if (!asset) {
    throw new Error("media registration returned no record")
  }
  return asset
}

/** An image at an outside address, fetched by the server into the library. */
export async function importToLibrary(url: string): Promise<MediaAsset> {
  const { media } = await sdk.client.fetch<{ media: MediaAsset }>("/admin/media/import", {
    method: "POST",
    body: { url },
  })
  return media
}

/** The library's lists and details are read again after a change. */
export function useMediaChanged() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: MEDIA_KEY })
}

export function useUpdateMedia(id: string) {
  const changed = useMediaChanged()
  return useMutation({
    mutationFn: (body: { alt?: string | null; filename?: string }) =>
      sdk.client.fetch<{ media: { id: string; alt: string | null; filename: string } }>(
        `/admin/media/${encodeURIComponent(id)}`,
        { method: "POST", body }
      ),
    onSettled: changed,
  })
}

export function useDeleteMedia() {
  const changed = useMediaChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/media/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: changed,
  })
}

/** "PNG · 1200 × 800 · 245 KB": what a thumbnail's caption says of the file. */
export function mediaFacts(asset: Pick<MediaAsset, "mime_type" | "width" | "height" | "size">) {
  const type = asset.mime_type?.split("/")[1]?.toUpperCase()
  const dimensions =
    asset.width && asset.height ? `${String(asset.width)} × ${String(asset.height)}` : null
  return [type === "JPEG" ? "JPG" : type, dimensions, asset.size ? formatBytes(asset.size) : null]
    .filter(Boolean)
    .join(" · ")
}

const BYTES = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 })

/** 245 KB, 1,2 MB: a file's size as people read it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${BYTES.format(bytes)} B`
  }
  return bytes < 1024 * 1024
    ? `${BYTES.format(bytes / 1024)} KB`
    : `${BYTES.format(bytes / (1024 * 1024))} MB`
}
