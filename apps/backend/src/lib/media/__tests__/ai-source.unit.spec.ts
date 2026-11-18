import sharp from "sharp"
import {
  DIGITAL_SOURCE_TYPES,
  deriveImages,
  digitalSourceTypeOf,
  digitalSourceXmp,
  prepareImage,
  sanitizeImage,
} from ".."

/**
 * adr/0071 §10 (Aşama 4): an AI made picture carries IPTC
 * DigitalSourceType; the cleaning keeps that one value and nothing else,
 * and every version made from the master carries it on.
 */

jest.setTimeout(30_000)

const EDITED = DIGITAL_SOURCE_TYPES.edited
const GENERATED = DIGITAL_SOURCE_TYPES.generated

const picture = (format: "jpeg" | "png" | "webp" | "avif" = "png") => {
  const image = sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
  return (format === "jpeg" ? image.jpeg() : format === "png" ? image.png() : image[format]())
    .withExif({ IFD0: { Make: "Phone", Copyright: "Ayşe" } })
    .toBuffer()
}

const termOf = async (bytes: Buffer) => digitalSourceTypeOf((await sharp(bytes).metadata()).xmp)

describe("the IPTC mark of an AI picture", () => {
  it("reads the term written as an attribute, an element or a resource; refuses any other", () => {
    expect(digitalSourceTypeOf(digitalSourceXmp(EDITED))).toBe(EDITED)
    expect(
      digitalSourceTypeOf(
        `<Iptc4xmpExt:DigitalSourceType>${GENERATED}</Iptc4xmpExt:DigitalSourceType>`
      )
    ).toBe(GENERATED)
    expect(digitalSourceTypeOf(`<Iptc4xmpExt:DigitalSourceType rdf:resource="${EDITED}"/>`)).toBe(
      EDITED
    )
    expect(digitalSourceTypeOf('DigitalSourceType="http://example.com/x"')).toBeNull()
    expect(digitalSourceTypeOf(undefined)).toBeNull()
    expect(() => digitalSourceXmp('x" onload="')).toThrow()
  })

  it("does not take long on a crafted packet", () => {
    const crafted = `DigitalSourceType ${"a".repeat(300_000)}`
    const started = Date.now()
    expect(digitalSourceTypeOf(crafted)).toBeNull()
    expect(Date.now() - started).toBeLessThan(500)
  })

  it.each(["jpeg", "png", "webp", "avif"] as const)(
    "a %s an AI service made is cleaned of everything but our mark",
    async (format) => {
      const clean = await sanitizeImage(await picture(format), format, { aiSource: "edited" })
      const meta = await sharp(clean.buffer).metadata()
      expect(meta.exif).toBeUndefined()
      expect(digitalSourceTypeOf(meta.xmp)).toBe(EDITED)
      // The packet is ours alone: no other property survives
      expect(meta.xmp?.toString("utf8")).not.toContain("Phone")
    }
  )

  it("keeps an uploaded file's own AI term, drops an unknown packet (the cleaning keeps the field)", async () => {
    const marked = await sharp(await picture("jpeg"))
      .withXmp(digitalSourceXmp(GENERATED))
      .jpeg()
      .toBuffer()
    expect(await termOf((await sanitizeImage(marked, "jpeg")).buffer)).toBe(GENERATED)

    const other = await sharp(await picture("jpeg"))
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><secret>GPS 41,29</secret></x:xmpmeta>')
      .jpeg()
      .toBuffer()
    const clean = await sanitizeImage(other, "jpeg")
    expect((await sharp(clean.buffer).metadata()).xmp).toBeUndefined()
  })

  it("an image with no mark gets none", async () => {
    const clean = await sanitizeImage(await picture("png"), "png")
    expect((await sharp(clean.buffer).metadata()).xmp).toBeUndefined()
  })

  it("every version made from a marked master carries the mark (srcset and share crop)", async () => {
    const prepared = await prepareImage(await picture("png"), "urun.png", "image", {
      aiSource: "edited",
    })
    const versions = await deriveImages(prepared.buffer)
    expect(versions.length).toBeGreaterThan(2)
    for (const version of versions) {
      expect(await termOf(version.buffer)).toBe(EDITED)
    }
  })

  it("versions of an unmarked master carry no mark", async () => {
    const prepared = await prepareImage(await picture("png"), "urun.png", "image")
    for (const version of await deriveImages(prepared.buffer)) {
      expect((await sharp(version.buffer).metadata()).xmp).toBeUndefined()
    }
  })
})
