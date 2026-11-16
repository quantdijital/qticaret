import { Readable } from "node:stream"
import { Modules } from "@medusajs/framework/utils"
import sharp from "sharp"
import { DEFAULT_UPLOAD_LIMITS } from "../../../lib/security/upload"
import { MEDIA_MODULE } from "../../../modules/media"
import { LOGO_SIDE_MAX, measureLogo } from "../logo-size"

const MIB = 1024 * 1024

interface MediaRecord {
  file_id: string
  width: number | null
  height: number | null
}

/** A container with one library record (or none) and storage that streams `chunks`. */
function setup(record: MediaRecord | null, chunks: () => Iterable<Buffer>) {
  let pulled = 0
  const getAsBuffer = jest.fn()
  const getDownloadStream = jest.fn(() =>
    Readable.from(
      (function* () {
        for (const chunk of chunks()) {
          pulled += 1
          yield chunk
        }
      })()
    )
  )
  const services: Record<string, unknown> = {
    [MEDIA_MODULE]: { listMediaAssets: () => Promise.resolve(record ? [record] : []) },
    [Modules.FILE]: { getAsBuffer, getDownloadStream },
  }
  const container = { resolve: (key: string) => services[key] } as never
  return { container, getAsBuffer, getDownloadStream, pulled: () => pulled }
}

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png()
    .toBuffer()

describe("a brand logo's size, read on the server (marka logosu boyutu)", () => {
  it("reads a logo kept from before the library rule (the backfill) by its header", async () => {
    const bytes = await png(240, 60)
    const { container, getAsBuffer } = setup(null, () => [bytes])
    await expect(measureLogo(container, "serbest.png", "https://cdn/serbest.png")).resolves.toEqual(
      { width: 240, height: 60 }
    )
    expect(getAsBuffer).not.toHaveBeenCalled()
  })

  it("stops reading a file larger than an upload may be, and leaves its size unknown", async () => {
    const chunks = Math.ceil(DEFAULT_UPLOAD_LIMITS.maxBytes / MIB) + 5
    const { container, getAsBuffer, pulled } = setup(null, function* () {
      for (let index = 0; index < chunks; index += 1) {
        yield Buffer.alloc(MIB)
      }
    })
    await expect(measureLogo(container, "buyuk.png", "https://cdn/buyuk.png")).resolves.toBeNull()
    expect(getAsBuffer).not.toHaveBeenCalled()
    // Read only to just past the limit, never the whole file
    expect(pulled()).toBe(DEFAULT_UPLOAD_LIMITS.maxBytes / MIB + 1)
  })

  it("reads a file of exactly the limit", async () => {
    const bytes = await png(90, 30)
    const pad = Buffer.alloc(DEFAULT_UPLOAD_LIMITS.maxBytes - bytes.length)
    const { container } = setup(null, () => [bytes, pad])
    await expect(measureLogo(container, "tam.png", "https://cdn/tam.png")).resolves.toEqual({
      width: 90,
      height: 30,
    })
  })

  it("takes the library's record, up to the longest side kept", async () => {
    const none = () => [Buffer.from("not a picture")]
    const fits = setup({ file_id: "kayit.png", width: LOGO_SIDE_MAX, height: 1 }, none)
    await expect(
      measureLogo(fits.container, "kayit.png", "https://cdn/kayit.png")
    ).resolves.toEqual({ width: LOGO_SIDE_MAX, height: 1 })
    expect(fits.getDownloadStream).not.toHaveBeenCalled()

    // A longer side (or a broken record) is no size: the file says none either
    for (const width of [LOGO_SIDE_MAX + 1, 0, 12.5]) {
      const over = setup({ file_id: "kayit.png", width, height: 10 }, none)
      await expect(measureLogo(over.container, "kayit.png", "https://cdn/kayit.png")).resolves.toBe(
        null
      )
    }
  })

  it("does not take another file's record", async () => {
    const bytes = await png(50, 25)
    const { container } = setup({ file_id: "baska.png", width: 600, height: 200 }, () => [bytes])
    await expect(measureLogo(container, "bu.png", "https://cdn/bu.png")).resolves.toEqual({
      width: 50,
      height: 25,
    })
  })
})
