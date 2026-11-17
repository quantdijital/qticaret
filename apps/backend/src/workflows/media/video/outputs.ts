import { createReadStream, createWriteStream } from "node:fs"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { versionName } from "../../../lib/media/derive"
import { VIDEO_MAX_BYTES } from "../../../lib/media/video/limits"
import type { PosterImages } from "../../../lib/media/video/poster"
import { VideoJobError, infraError, inputError } from "../../../lib/media/video/transcode-errors"
import type { MadeOutput } from "../../../lib/media/video/transcode"
import { toSlug } from "../../../lib/seo/slug"
import { isMissingFile, removeFiles, storePublicFile } from "../files"
import type { StoredFile } from "../files"
import { describeDerivatives } from "../steps/derive-media"
import { productVideos } from "./read"

/**
 * The job's dealings with storage (adr/0069 §4 steps 1, 6–7): the private
 * source down to the job's directory, the outputs and the poster up as
 * public files named after the product. A file written is reported at
 * once (`onStored`), so a failure later removes it.
 */

const IMAGE_MIME = { webp: "image/webp", avif: "image/avif", jpeg: "image/jpeg" } as const
const VIDEO_MIME = { mp4: "video/mp4", webm: "video/webm" } as const

/** Stops a download past the largest upload: a stored file grown since its check. */
function byteCap(max: number): Transform {
  let seen = 0
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length
      callback(seen > max ? inputError("video.too_large") : null, chunk)
    },
  })
}

/** The private source into `path` (0600, a new file); missing in storage: an input error. */
export async function downloadSource(
  container: MedusaContainer,
  fileId: string,
  path: string
): Promise<void> {
  try {
    const stream = await container.resolve(Modules.FILE).getDownloadStream(fileId)
    await pipeline(
      stream,
      byteCap(VIDEO_MAX_BYTES),
      createWriteStream(path, { mode: 0o600, flags: "wx" })
    )
  } catch (error) {
    if (isMissingFile(error)) {
      throw inputError("video.unreadable", "video source: not in storage")
    }
    if (error instanceof VideoJobError) {
      throw error
    }
    throw infraError(`video source: download failed (${(error as Error | null)?.name ?? "?"})`)
  }
}

/** A made file streamed to public storage; on a failure nothing of it is left. */
async function storeVideoFile(
  container: MedusaContainer,
  filename: string,
  output: MadeOutput,
  kind: keyof typeof VIDEO_MIME
): Promise<StoredFile> {
  const upload = await container
    .resolve(Modules.FILE)
    .getUploadStream({ filename, mimeType: VIDEO_MIME[kind], access: "public" })
  try {
    await pipeline(createReadStream(output.path), upload.writeStream)
    await upload.promise
  } catch {
    await removeFiles(container, [upload.fileKey])
    throw infraError(`video output: storage refused the ${kind}`)
  }
  return { id: upload.fileKey, url: upload.url }
}

export interface StoredOutputs {
  outputs: { mp4: { url: string; bytes: number }; webm: { url: string; bytes: number } }
  output_file_ids: string[]
  poster: Record<string, unknown>
  poster_file_ids: string[]
  /** The bytes of everything stored here. */
  bytes: number
}

/**
 * The outputs and the poster stored public, named `{slug}-video-{n}.mp4`,
 * `.webm`, `.jpg` and `{slug}-video-{n}-{width}.webp` (adr/0069 §4).
 */
export async function storeOutputs(
  container: MedusaContainer,
  base: string,
  outputs: Record<keyof typeof VIDEO_MIME, MadeOutput>,
  poster: PosterImages,
  onStored: (fileId: string) => void
): Promise<StoredOutputs> {
  const mp4 = await storeVideoFile(container, `${base}.mp4`, outputs.mp4, "mp4")
  onStored(mp4.id)
  const webm = await storeVideoFile(container, `${base}.webm`, outputs.webm, "webm")
  onStored(webm.id)
  const store = async (name: string, mime: string, buffer: Buffer) => {
    try {
      const file = await storePublicFile(container, name, mime, buffer)
      onStored(file.id)
      return file
    } catch {
      throw infraError("video poster: storage refused it")
    }
  }
  const master = await store(`${base}.jpg`, IMAGE_MIME.jpeg, poster.master.buffer)
  const versions = []
  for (const derivative of poster.derivatives) {
    const file = await store(
      versionName(base, derivative),
      IMAGE_MIME[derivative.format],
      derivative.buffer
    )
    versions.push({ derivative, file })
  }
  const posterBytes =
    poster.master.buffer.length +
    poster.derivatives.reduce((sum, derivative) => sum + derivative.buffer.length, 0)
  return {
    outputs: {
      mp4: { url: mp4.url, bytes: outputs.mp4.bytes },
      webm: { url: webm.url, bytes: outputs.webm.bytes },
    },
    output_file_ids: [mp4.id, webm.id],
    poster: {
      url: master.url,
      width: poster.master.width,
      height: poster.master.height,
      derivatives: describeDerivatives(versions),
    },
    poster_file_ids: [master.id, ...versions.map(({ file }) => file.id)],
    bytes: outputs.mp4.bytes + outputs.webm.bytes + posterBytes,
  }
}

/**
 * What a video's files are named after: its product's handle as a slug and
 * its place among the product's videos (1, 2); a video without a product
 * (deleted meanwhile) is `urun-video-1`.
 */
export async function videoNaming(
  container: MedusaContainer,
  videoId: string
): Promise<{ slug: string; n: number }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "media_video",
    fields: ["id", "product.id", "product.handle"],
    filters: { id: videoId },
  })
  const row = data[0] as { product?: { id: string; handle?: string | null } | null } | undefined
  const product = row?.product
  const slug = toSlug(product?.handle ?? "", 60) || "urun"
  if (!product) {
    return { slug, n: 1 }
  }
  const siblings = (await productVideos(container, product.id)) ?? []
  const at = siblings.findIndex((video) => video.id === videoId)
  return { slug, n: at < 0 ? 1 : at + 1 }
}
