import sharp from "sharp"
import type {
  ImageEditConnector,
  ImageEditRequest,
  ImageEditResult,
  ImageSceneRequest,
} from "./image-types"

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
  /** A scene: the picture on a light grey canvas twice its size, so the result differs by size. */
  async scene(request: ImageSceneRequest): Promise<ImageEditResult> {
    const image = sharp(request.image.bytes, { failOn: "error" })
    const { width, height } = await image.metadata()
    const bytes = await image
      .flatten({ background: "#ffffff" })
      .extend({
        top: Math.ceil(height / 2),
        bottom: Math.ceil(height / 2),
        left: Math.ceil(width / 2),
        right: Math.ceil(width / 2),
        background: "#e5e5e5",
      })
      .png()
      .toBuffer()
    return { kind: "bytes", bytes, usage: {} }
  },
}
