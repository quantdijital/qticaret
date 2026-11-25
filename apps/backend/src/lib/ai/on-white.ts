import sharp from "sharp"
import { MAX_INPUT_PIXELS } from "../media/sanitize"
import { readImageInfo } from "../security/upload/image-header"
import { aiProviderError } from "./errors"
import { VISION_ENCODE_TIMEOUT_SECONDS } from "./image-input"
import type { AiService } from "./registry/services"

/** A cut-out carries transparency: only these come back from a service as one. */
const CUT_OUT_TYPES: readonly string[] = ["png", "webp"]

/**
 * A white background made here from a service's cut-out (Bria documents
 * none): the transparent result laid on pure white and written as a JPEG,
 * as Photoroom's white comes back. The bytes are the service's, untrusted:
 * their type is read from their first bytes before any decoder sees them
 * (a PNG or WebP alone), then read within the upload's pixel limit and
 * time, and checked once more as an upload afterwards (`run-image.ts`). A
 * picture that is not a cut-out or cannot be read is the service's fault:
 * `ai.provider_response_invalid`.
 */
export async function laidOnWhite(service: AiService, bytes: Buffer): Promise<Buffer> {
  const info = readImageInfo(bytes)
  if (info === null || !CUT_OUT_TYPES.includes(info.type)) {
    throw aiProviderError({
      service: service.id,
      key: "ai.provider_response_invalid",
      code: "result_not_a_cut_out",
    })
  }
  try {
    return await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .timeout({ seconds: VISION_ENCODE_TIMEOUT_SECONDS })
      .toBuffer()
  } catch {
    throw aiProviderError({
      service: service.id,
      key: "ai.provider_response_invalid",
      code: "result_not_laid_on_white",
    })
  }
}
