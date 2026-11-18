import type { ImageBackground } from "../registry/services"
import type { AiImageInput, AiUsage } from "./types"

/**
 * The `image_edit` connector (adr/0071 §2): a picture of the shop's in, an
 * edited picture out, as bytes or as an address to fetch. Either way the
 * result is untrusted until `lib/ai/run-image.ts` has fetched it from a
 * listed host and the upload check has read it (§9).
 */

export interface ImageEditRequest {
  image: AiImageInput
  background: ImageBackground
  signal?: AbortSignal
}

export type ImageEditResult =
  { kind: "bytes"; bytes: Buffer; usage: AiUsage } | { kind: "url"; url: string; usage: AiUsage }

/**
 * A product photo set in a scene (Aşama 7). `setting` is a sector pack's
 * scene description (lib/ai/scenes.ts), read on the server; never text
 * from a client. The connector wraps it in its own fixed instruction.
 */
export interface ImageSceneRequest {
  image: AiImageInput
  setting: string
  signal?: AbortSignal
}

export interface ImageEditConnector {
  edit: (request: ImageEditRequest) => Promise<ImageEditResult>
  /** Only where the service's target has a scene endpoint. */
  scene?: (request: ImageSceneRequest) => Promise<ImageEditResult>
}

/** Image editing and generation (adr/0071 §8). */
export const IMAGE_TIMEOUT_MS = 120_000
