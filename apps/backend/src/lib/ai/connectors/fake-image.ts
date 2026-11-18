import sharp from "sharp"
import type { ImageEditConnector, ImageEditRequest, ImageEditResult } from "./image-types"

/**
 * The fake service's image editing (NODE_ENV test and development only;
 * `lib/ai/image-connector-of.ts`): never leaves the machine. The same
 * picture back as a PNG, on white or with an alpha channel, so a test
 * can tell the result from the original by its bytes and its type.
 */
export const fakeImageConnector: ImageEditConnector = {
  async edit(request: ImageEditRequest): Promise<ImageEditResult> {
    const image = sharp(request.image.bytes, { failOn: "error" })
    const bytes = await (
      request.background === "white"
        ? image.flatten({ background: "#ffffff" })
        : image.ensureAlpha()
    )
      .png()
      .toBuffer()
    return { kind: "bytes", bytes, usage: {} }
  },
}
