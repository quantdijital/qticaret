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

export interface ImageEditConnector {
  edit: (request: ImageEditRequest) => Promise<ImageEditResult>
}

/** Image editing and generation (adr/0071 §8). */
export const IMAGE_TIMEOUT_MS = 120_000
