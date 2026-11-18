import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A product image as the media module keeps it (F3.3): alt text and its versions' state. */
export interface ProductMedia {
  id: string
  url: string
  /** None for an image added by its URL: an alt text, but no versions. */
  file_id: string | null
  alt: string | null
  /** When its WebP/AVIF versions and share crop were made; null while they are being made. */
  derived_at: string | null
  /** Made by an AI service (adr/0071 §5): marked on its tile. */
  ai_source?: "edited" | "generated" | null
}

export const MEDIA_FIELDS = [
  "media_assets.id",
  "media_assets.file_id",
  "media_assets.url",
  "media_assets.alt",
  "media_assets.derived_at",
  "media_assets.ai_source",
]

/** Images just uploaded become product images with an alt text and versions. */
export const registerMedia = (fileIds: string[]) =>
  sdk.client.fetch<{ media: { id: string; url: string }[] }>("/admin/media", {
    method: "POST",
    body: { file_ids: fileIds },
  })

export function useSaveAlt(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) =>
      sdk.client.fetch(`/admin/media/${encodeURIComponent(id)}`, {
        method: "POST",
        body: { alt },
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products", "detail", productId] }),
        // The advisor weighs alt texts
        client.invalidateQueries({ queryKey: ["seo"] }),
      ])
    },
  })
}

// The server links images and makes versions after a save; look again for this long
const SETTLE_MS = 2 * 60 * 1000

/** Whether a product's images are still being taken in: a record or versions to come. */
export function isMediaSettling(product: {
  updated_at?: string | Date | null
  images?: { url: string }[] | null
  media_assets?: ProductMedia[] | null
}): boolean {
  const updated = product.updated_at ? new Date(product.updated_at).getTime() : 0
  if (Date.now() - updated > SETTLE_MS) {
    return false
  }
  const records = new Map((product.media_assets ?? []).map((each) => [each.url, each]))
  return (product.images ?? []).some((image) => {
    const record = records.get(image.url)
    return !record || (record.file_id !== null && !record.derived_at)
  })
}
