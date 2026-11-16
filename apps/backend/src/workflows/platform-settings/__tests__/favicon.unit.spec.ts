import sharp from "sharp"
import { SVG_MAX_BYTES } from "../../../lib/media/svg"
import { cleanSvg } from "../../../lib/media/svg-clean"
import { MAIL_LOGO_BOX, appleTouchPng, mailLogoPng } from "../../../lib/media/svg-raster"
import {
  APPLE_TOUCH_SIDE,
  FAVICON_MAX_BYTES,
  FAVICON_SVG_MAX_BYTES,
  appleTouchOf,
  faviconProblem,
  mailPngOf,
} from "../steps/brand-images"

describe("faviconProblem: what the site icon may be", () => {
  it("takes a PNG within 1 MB and an SVG within 100 KB", () => {
    expect(faviconProblem({ mime_type: "image/png", size: 4096 })).toBeNull()
    expect(faviconProblem({ mime_type: "image/png", size: FAVICON_MAX_BYTES })).toBeNull()
    expect(faviconProblem({ mime_type: "image/svg+xml", size: FAVICON_SVG_MAX_BYTES })).toBeNull()
  })

  it("refuses one whose size was never measured: it proves no limit", () => {
    for (const type of ["image/png", "image/svg+xml"]) {
      expect(faviconProblem({ mime_type: type, size: null })).toBe(
        "platform_settings.favicon_unknown"
      )
    }
  })

  it("refuses any other type: the library holds no ICO, and a JPEG is no icon", () => {
    for (const type of ["image/jpeg", "image/webp", "image/avif", "image/x-icon", null]) {
      expect(faviconProblem({ mime_type: type, size: 100 })).toBe("platform_settings.favicon_type")
    }
  })

  it("refuses one past its limit", () => {
    expect(faviconProblem({ mime_type: "image/png", size: FAVICON_MAX_BYTES + 1 })).toBe(
      "platform_settings.favicon_too_large"
    )
    expect(faviconProblem({ mime_type: "image/svg+xml", size: FAVICON_SVG_MAX_BYTES + 1 })).toBe(
      "platform_settings.favicon_too_large"
    )
  })
})

describe("the SVG icon's home screen PNG", () => {
  it("draws the cleaned SVG at 180 px square, whatever size it names", async () => {
    for (const attrs of ['viewBox="0 0 16 16"', 'viewBox="0 0 9000 3000"']) {
      const { buffer } = cleanSvg(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="100%" height="100%" fill="#c00"/></svg>`
        ),
        SVG_MAX_BYTES
      )
      const png = await appleTouchPng(buffer)
      const meta = await sharp(png).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual([
        "png",
        APPLE_TOUCH_SIDE,
        APPLE_TOUCH_SIDE,
      ])
      expect(meta.hasAlpha).toBe(false)
    }
  })

  it("reads the PNGs kept on the record, and none from anything else", () => {
    expect(
      appleTouchOf({ apple_touch: { url: "https://cdn.example/a.png", width: 180, height: 180 } })
    ).toEqual({
      url: "https://cdn.example/a.png",
      width: APPLE_TOUCH_SIDE,
      height: APPLE_TOUCH_SIDE,
    })
    expect(
      mailPngOf({ mail_png: { url: "https://cdn.example/m.png", width: 600, height: 200 } })
    ).toEqual({ url: "https://cdn.example/m.png", width: 600, height: 200 })
    expect(appleTouchOf(null)).toBeNull()
    expect(mailPngOf({ srcset: {} })).toBeNull()
  })
})

describe("the SVG logo's PNG for mail clients", () => {
  it("draws a wide logo within 600 × 200, keeping its shape and its transparent ground", async () => {
    const { buffer } = cleanSvg(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 50"><rect width="300" height="50" fill="#0a0"/></svg>'
      ),
      SVG_MAX_BYTES
    )
    const meta = await sharp(await mailLogoPng(buffer)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(["png", MAIL_LOGO_BOX.width, 100])
    expect(meta.hasAlpha).toBe(true)
  })
})
