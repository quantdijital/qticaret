import { registerMedia } from "@/features/products/api/media"
import { sdk } from "@/lib/sdk"

// What the server takes (docs/04 upload checks); it checks the bytes again
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif"

/**
 * An image for a page: uploaded (cleaned of metadata on the way, F3.3) and
 * kept in the media library, whose address is the only kind a page may use.
 */
export async function uploadContentImage(file: File): Promise<string> {
  const { files } = await sdk.admin.upload.create({ files: [file] })
  const stored = files[0]
  if (!stored) {
    throw new Error("upload returned no file")
  }
  const { media } = await registerMedia([stored.id])
  const url = media[0]?.url
  if (!url) {
    throw new Error("media registration returned no record")
  }
  return url
}
