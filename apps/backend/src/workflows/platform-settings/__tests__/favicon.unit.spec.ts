import { FAVICON_MAX_BYTES, faviconProblem } from "../steps/favicon"

describe("faviconProblem: what the site icon may be", () => {
  it("takes a PNG within the limit", () => {
    expect(faviconProblem({ mime_type: "image/png", size: 4096 })).toBeNull()
    expect(faviconProblem({ mime_type: "image/png", size: FAVICON_MAX_BYTES })).toBeNull()
  })

  it("refuses one whose size was never measured: it proves no limit", () => {
    expect(faviconProblem({ mime_type: "image/png", size: null })).toBe(
      "platform_settings.favicon_unknown"
    )
  })

  it("refuses any other type: the library holds no ICO or SVG, and a JPEG is no icon", () => {
    for (const type of ["image/jpeg", "image/webp", "image/avif", "image/svg+xml", null]) {
      expect(faviconProblem({ mime_type: type, size: 100 })).toBe("platform_settings.favicon_type")
    }
  })

  it("refuses one past 1 MB", () => {
    expect(faviconProblem({ mime_type: "image/png", size: FAVICON_MAX_BYTES + 1 })).toBe(
      "platform_settings.favicon_too_large"
    )
  })
})
