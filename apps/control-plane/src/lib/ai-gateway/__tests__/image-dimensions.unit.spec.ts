import { pixelSizeOf } from "../image-dimensions"
import {
  jpegHeader,
  pngHeader,
  webpExtendedHeader,
  webpLosslessHeader,
  webpLossyHeader,
} from "./image-headers"

/**
 * A picture's size read from its header alone (image-dimensions.ts), so
 * the gateway can hold a picture to its pixel limit without decoding it.
 */
describe("pixelSizeOf", () => {
  it("reads PNG's IHDR, JPEG's frame and each WebP header", () => {
    expect(pixelSizeOf("image/png", pngHeader(1200, 800))).toEqual({ width: 1200, height: 800 })
    expect(pixelSizeOf("image/jpeg", jpegHeader(640, 480))).toEqual({ width: 640, height: 480 })
    // A progressive frame (C2) too
    expect(pixelSizeOf("image/jpeg", jpegHeader(300, 200, 0xc2))).toEqual({
      width: 300,
      height: 200,
    })
    expect(pixelSizeOf("image/webp", webpLossyHeader(1024, 768))).toEqual({
      width: 1024,
      height: 768,
    })
    expect(pixelSizeOf("image/webp", webpLosslessHeader(16_384, 2))).toEqual({
      width: 16_384,
      height: 2,
    })
    expect(pixelSizeOf("image/webp", webpExtendedHeader(10_000, 9_000))).toEqual({
      width: 10_000,
      height: 9_000,
    })
  })

  it("skips a JPEG's fill bytes and segments before its frame", () => {
    const jpeg = jpegHeader(50, 40)
    const filled = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff]), jpeg.subarray(2)])
    expect(pixelSizeOf("image/jpeg", filled)).toEqual({ width: 50, height: 40 })
  })

  it("reads nothing from a header cut short, of another type, or with an empty side", () => {
    const unread: [string, Buffer][] = [
      ["image/png", pngHeader(10, 10).subarray(0, 20)],
      ["image/png", pngHeader(0, 10)],
      ["image/png", jpegHeader(10, 10)],
      ["image/jpeg", jpegHeader(10, 10).subarray(0, 25)],
      ["image/jpeg", jpegHeader(10, 0)],
      // The image's data starts before any frame
      ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 8, 1, 2, 3, 4, 5, 6])],
      // A segment that claims less than its own length field
      ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 0, 0, 0, 0])],
      ["image/jpeg", Buffer.from([0xff, 0xd8, 0x00, 0x00, 0, 0])],
      ["image/webp", webpLossyHeader(10, 10).subarray(0, 28)],
      ["image/webp", webpExtendedHeader(10, 10).subarray(0, 29)],
      ["image/webp", Buffer.from("RIFF\0\0\0\0WEBPVP8?").subarray(0, 16)],
      ["image/gif", Buffer.from("GIF89a")],
      ["image/png", Buffer.alloc(0)],
    ]
    for (const [type, bytes] of unread) {
      expect([type, pixelSizeOf(type, bytes)]).toEqual([type, null])
    }
  })
})
