import { Readable } from "node:stream"
import sharp from "sharp"
import {
  VISION_ENCODE_TIMEOUT_SECONDS,
  VISION_SOURCE_MAX_BYTES,
  readVisionSource,
  visionImage,
} from "../image-input"

const png = () =>
  sharp({ create: { width: 40, height: 20, channels: 3, background: "#808080" } })
    .png()
    .toBuffer()

describe("reading a stored picture (readVisionSource)", () => {
  it("returns the whole file when it is within the limit", async () => {
    const stream = Readable.from([Buffer.from("ab"), Buffer.from("cd")])
    expect((await readVisionSource(stream))?.toString()).toBe("abcd")
    expect(stream.destroyed).toBe(true)
  })

  it("stops at the limit without pulling the rest", async () => {
    let pulled = 0
    const chunk = Buffer.alloc(1024 * 1024)
    const stream = Readable.from(
      (function* () {
        for (let i = 0; i < 64; i++) {
          pulled++
          yield chunk
        }
      })()
    )
    expect(await readVisionSource(stream)).toBeNull()
    expect(pulled).toBeLessThanOrEqual(VISION_SOURCE_MAX_BYTES / chunk.length + 2)
    expect(stream.destroyed).toBe(true)
  })
})

describe("re-encoding under a time limit", () => {
  it("bounds the encoding with sharp's timeout", async () => {
    const proto = (sharp as unknown as { prototype: { timeout: (o: unknown) => unknown } })
      .prototype
    const spy = jest.spyOn(proto, "timeout")
    try {
      await visionImage(await png(), "fake")
      expect(spy).toHaveBeenCalledWith({ seconds: VISION_ENCODE_TIMEOUT_SECONDS })
    } finally {
      spy.mockRestore()
    }
  })
})
