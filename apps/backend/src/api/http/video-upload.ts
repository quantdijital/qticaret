import type { MedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { RetryableError, ValidationError } from "../../lib/errors"
import {
  UPLOAD_CONCURRENCY,
  VIDEO_MAX_REQUEST_BYTES,
  VIDEOS_PER_PRODUCT,
  createSlots,
  makeVideoTempDir,
  probeVideo,
  readHead,
  receiveVideo,
  removeVideoTempDir,
  videoSignature,
  videoUploadAvailable,
} from "../../lib/media/video"
import type { ProbeVerdict, ReceivedVideo, VideoSignature } from "../../lib/media/video"
import { assertStorageFits } from "../../lib/plan-limits"
import { drainBody } from "../../lib/security/upload/drain"
import { productVideos } from "../../workflows/media/video/read"

/**
 * A product video's upload, checked before anything is stored (adr/0069
 * §3), in this order: the product exists, has room for another video and
 * the package's storage takes the declared size; the programs are on this
 * machine; a place among the uploads this process takes at once; the
 * body, streamed to a private temporary file and cut past 50 MB; what the
 * bytes are (never the name or MIME type sent); ffprobe forced to that
 * demuxer. The temporary directory goes on every way out.
 */

export type CheckedVideo = ReceivedVideo & VideoSignature & ProbeVerdict

const uploadSlots = createSlots({
  concurrency: UPLOAD_CONCURRENCY,
  // None wait: a body held open while waiting would only tie up the connection
  maxWaiting: 0,
  waitTimeoutMs: 0,
  busy: () => new RetryableError("video.upload_busy", { retryAfterMs: 10_000 }),
})

/** Uploads in progress here (tests, logs). */
export const uploadSlotState = () => uploadSlots.state()

const declaredBytes = (req: MedusaRequest): number => {
  const declared = Number(req.headers["content-length"])
  return Number.isSafeInteger(declared) && declared > 0 ? declared : 0
}

/** Before the body is read: the product, its room for a video, the storage limit. */
async function precheck(container: MedusaContainer, productId: string, bytes: number) {
  const videos = await productVideos(container, productId)
  if (videos === null) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  if (videos.length >= VIDEOS_PER_PRODUCT) {
    throw new ValidationError("video.limit_per_product", { field: "file" })
  }
  await assertStorageFits(container, bytes)
}

/**
 * Runs `use` with the checked clip, then removes its temporary file
 * whatever happened. A refusal before the body was read drains it (the
 * path's gate bounds it at 52 MB), so the answer reaches the client. On
 * every way out the order is fixed (review): the receiver has closed the
 * file, the directory is removed, and only then is the place given back,
 * so a new upload never starts beside an old one's file still on disk.
 * `tempRoot`: where the directory is made (tests; the system's otherwise).
 */
export async function withCheckedVideo<T>(
  req: MedusaRequest,
  productId: string,
  use: (video: CheckedVideo) => Promise<T>,
  tempRoot?: string
): Promise<T> {
  let reading = false
  let dir: string | null = null
  let release: (() => void) | null = null
  try {
    // The product, its room and the storage limit first: they need no body and no tools,
    // and say more than "unavailable" would
    await precheck(req.scope as MedusaContainer, productId, declaredBytes(req))
    if (!(await videoUploadAvailable())) {
      throw new RetryableError("video.upload_unavailable")
    }
    release = await uploadSlots.take()
    dir = await makeVideoTempDir(tempRoot)
    reading = true
    const received = await receiveVideo(req, dir)
    const signature = videoSignature(await readHead(received.path))
    // GIF waits for slice 7: refused as any other type until then
    if (!signature || signature.format === "gif") {
      throw new ValidationError("video.unsupported_type", { field: "file" })
    }
    const verdict = await probeVideo(received.path, signature.demuxer)
    return await use({ ...received, ...signature, ...verdict })
  } finally {
    // Refused before the body was read: it is drained first, so the refusal reaches the
    // client instead of a reset (bounded by the path's 52 MB; drain.ts)
    if (!reading) {
      await drainBody(req, { maxBytes: VIDEO_MAX_REQUEST_BYTES })
    }
    if (dir !== null) {
      await removeVideoTempDir(dir)
    }
    release?.()
  }
}
