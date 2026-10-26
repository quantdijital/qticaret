import sharp from "sharp"
import {
  MASTER_MAX_SIDE,
  OG_SIZE,
  derivativeName,
  deriveImages,
  sanitizeImage,
  srcsetWidths,
} from ".."

/** A photo as a phone writes it: EXIF with GPS and camera, turned on its side by its orientation tag. */
async function phonePhoto(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Phone", Model: "Camera 12", Copyright: "Ayşe" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 0/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer()
}

describe("uploaded images (adr/0016)", () => {
  it("drops EXIF and GPS, and turns the photo upright by its orientation (KK)", async () => {
    const original = await phonePhoto(60, 40)
    const before = await sharp(original).metadata()
    expect(before.exif).toBeDefined()
    expect(before.orientation).toBe(6)

    const clean = await sanitizeImage(original, "jpeg")
    const after = await sharp(clean.buffer).metadata()
    expect(after.exif).toBeUndefined()
    expect(after.xmp).toBeUndefined()
    expect(after.iptc).toBeUndefined()
    expect(after.orientation).toBeUndefined()
    expect(after.format).toBe("jpeg")
    // Orientation 6 is a quarter turn: 60×40 stored, 40×60 seen
    expect([clean.width, clean.height]).toEqual([40, 60])
  })

  it("keeps the format and caps the longest side", async () => {
    const big = await sharp({
      create: { width: 3000, height: 1000, channels: 4, background: "#0000" },
    })
      .png()
      .toBuffer()
    const clean = await sanitizeImage(big, "png")
    expect((await sharp(clean.buffer).metadata()).format).toBe("png")
    expect([clean.width, clean.height]).toEqual([MASTER_MAX_SIDE, 853])
  })

  it("refuses bytes that are not the image they claim", async () => {
    await expect(sanitizeImage(Buffer.from("not an image"), "jpeg")).rejects.toThrow()
  })

  it("serves a srcset no wider than the image, and a share crop", async () => {
    expect(srcsetWidths(3000)).toEqual([400, 800, 1600])
    expect(srcsetWidths(1000)).toEqual([400, 800, 1000])
    expect(srcsetWidths(800)).toEqual([400, 800])
    expect(srcsetWidths(300)).toEqual([300])

    const derivatives = await deriveImages(await phonePhoto(1200, 900))
    expect(
      derivatives.map(({ kind, format, width }) => `${kind}:${format}:${String(width)}`)
    ).toEqual([
      "srcset:webp:400",
      "srcset:avif:400",
      "srcset:webp:800",
      "srcset:avif:800",
      "srcset:webp:1200",
      "srcset:avif:1200",
      "og:jpeg:1200",
    ])
    const og = derivatives.at(-1)
    expect(og && [og.width, og.height]).toEqual([OG_SIZE.width, OG_SIZE.height])
    expect((await sharp(og?.buffer).metadata()).format).toBe("jpeg")
    const [first] = derivatives
    expect(first && derivativeName("keten-gomlek", 2, first)).toBe("keten-gomlek-2-400.webp")
    expect(og && derivativeName("keten-gomlek", 1, og)).toBe("keten-gomlek-1-og.jpg")
  })
})
