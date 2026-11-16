import type { MedusaContainer } from "@medusajs/framework/types"
import { isValidationError } from "../../errors"
import { validateLibraryUpload, validateUpload } from "../../security/upload"
import { imageUrlsOf } from "../../../api/validation/svg-image-gate"
import { SVG_ELSEWHERE, namesSvg, refuseSvgImages } from "../svg-use"

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect/></svg>')

function containerWith(svgUrls: string[]): Pick<MedusaContainer, "resolve"> {
  return {
    resolve: () => ({
      listMediaAssets: (filters: { url: string[] }) =>
        Promise.resolve(filters.url.filter((url) => svgUrls.includes(url)).map((id) => ({ id }))),
    }),
  }
}

async function refusal(promise: Promise<void>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "thrown"
  }
}

describe("where an SVG may stand (the logos and the site icon only)", () => {
  it("tells an SVG address by its path", () => {
    expect(namesSvg("https://cdn.example/logo.svg")).toBe(true)
    expect(namesSvg("https://cdn.example/logo.SVG?v=2#x")).toBe(true)
    expect(namesSvg("https://cdn.example/logo.svgz")).toBe(true)
    expect(namesSvg("https://cdn.example/svg/logo.png")).toBe(false)
  })

  it("refuses a library SVG or an .svg address for any other field, by what the server knows", async () => {
    const container = containerWith(["https://cdn.example/a"])
    expect(await refusal(refuseSvgImages(container, ["https://cdn.example/a"], "image"))).toBe(
      SVG_ELSEWHERE
    )
    expect(await refusal(refuseSvgImages(container, ["https://x.example/b.svg"], "image"))).toBe(
      SVG_ELSEWHERE
    )
    expect(
      await refusal(refuseSvgImages(container, ["https://cdn.example/c.png", null], "image"))
    ).toBeNull()
  })

  it("reads every picture a product write names: thumbnail, images, a batch's and a variant's", () => {
    expect(
      imageUrlsOf({
        thumbnail: "t.png",
        images: [{ url: "a.png" }, "b.png", { id: "img_1" }],
        create: [{ images: [{ url: "c.png" }], variants: [{ images: [{ url: "d.svg" }] }] }],
        update: [{ id: "prod_1", thumbnail: "e.png" }],
      }).sort()
    ).toEqual(["a.png", "b.png", "c.png", "d.svg", "e.png", "t.png"])
    expect(imageUrlsOf(null)).toEqual([])
    expect(imageUrlsOf("x")).toEqual([])
  })

  it("takes an SVG only through the library's own upload, by its content", () => {
    expect(validateLibraryUpload({ buffer: SVG, originalname: "logo.png" }).type).toBe("svg")
    expect(() => validateUpload({ buffer: SVG, originalname: "logo.svg" })).toThrow()
    expect(() =>
      validateLibraryUpload({ buffer: Buffer.from("<html><svg/></html>"), originalname: "x.svg" })
    ).toThrow()
    try {
      validateLibraryUpload({
        buffer: Buffer.concat([SVG, Buffer.alloc(201 * 1024, 32)]),
        originalname: "big.svg",
      })
      throw new Error("taken")
    } catch (error) {
      expect(isValidationError(error) ? error.safeMessage : error).toBe("upload.svg_too_large")
    }
  })
})
