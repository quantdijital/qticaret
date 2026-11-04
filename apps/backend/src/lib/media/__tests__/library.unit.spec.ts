import sharp from "sharp"
import { isValidationError } from "../../errors"
import { MEDIA_NAME_MAX, displayName, prepareImage } from ".."

jest.setTimeout(30_000)

const refusal = async (work: Promise<unknown>) => {
  try {
    await work
  } catch (error) {
    return isValidationError(error) ? { key: error.safeMessage, field: error.field } : error
  }
  throw new Error("expected a refusal")
}

describe("a library file's name (docs/06 Ortam kütüphanesi)", () => {
  it.each([
    ["1792345678901-kupa.jpg", "kupa.jpg"],
    ["kupa-01JQ7ZQ3V8XK2M4N6P8R0T2W4Y.jpg", "kupa.jpg"],
    ["https://cdn.example.com/files/kupa-on-01JQ7ZQ3V8XK2M4N6P8R0T2W4Y.webp", "kupa-on.webp"],
    ["http://localhost:9000/static/1792345678901-g%C3%B6rsel.png", "görsel.png"],
    // A name without storage's additions is kept whole; a broken escape is shown as it is
    ["logo.png", "logo.png"],
    ["bad-%E0.png", "bad-%E0.png"],
  ])("%s reads as %s", (key, name) => {
    expect(displayName(key)).toBe(name)
  })

  it("never runs past the rename limit, and is never empty", () => {
    expect(displayName(`${"a".repeat(400)}.png`)).toHaveLength(MEDIA_NAME_MAX)
    expect(displayName("1792345678901-")).toBe("1792345678901-")
    expect(displayName("")).toBe("file")
  })
})

describe("an image brought in from an address (docs/04, F3.3)", () => {
  const photo = () =>
    sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 9, g: 9, b: 9 } } })
      .jpeg()
      .withExif({ IFD0: { Make: "Phone" } })
      .toBuffer()

  it("is checked by its bytes and stored cleaned, under a slug of its own name", async () => {
    const image = await prepareImage(await photo(), "Yaz Ürünleri.png", "url")
    // The bytes are a JPEG: the extension follows them, not the name
    expect(image).toMatchObject({
      filename: "yaz-urunleri.jpg",
      mimeType: "image/jpeg",
      width: 40,
      height: 30,
    })
    expect((await sharp(image.buffer).metadata()).exif).toBeUndefined()
  })

  it("refuses SVG (it can carry script), text and anything not an accepted image", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>')
    await expect(refusal(prepareImage(svg, "logo.svg", "url"))).resolves.toEqual({
      key: "upload.unsupported_type",
      field: "url",
    })
    await expect(
      refusal(prepareImage(Buffer.from("a,b\n1,2\n"), "list.csv", "url"))
    ).resolves.toEqual({ key: "media.not_an_image", field: "url" })
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1")
    await expect(refusal(prepareImage(gif, "a.gif", "url"))).resolves.toEqual({
      key: "upload.unsupported_type",
      field: "url",
    })
  })

  it("refuses a file past the upload's size", async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    await expect(refusal(prepareImage(big, "big.jpg", "url"))).resolves.toEqual({
      key: "upload.too_large",
      field: "url",
    })
  })
})
