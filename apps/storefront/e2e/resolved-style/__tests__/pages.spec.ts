import { describe, expect, it } from "vitest"
import { pageUrl, parseCaptureArgs, redactor } from "../pages.ts"

const prefix = "/onizleme/sfs_0123456789abcdef0123456789abcdef.abc.secret"

describe("resolved style capture's pages", () => {
  it("opens a shop path as itself, or as the theme editor preview's page", () => {
    expect(pageUrl("http://localhost:8000", "", "/urun/caki")).toBe(
      "http://localhost:8000/urun/caki"
    )
    expect(pageUrl("http://localhost:8000", prefix, "/")).toBe(`http://localhost:8000${prefix}`)
    expect(pageUrl("http://localhost:8000", prefix, "/arama?q=çakı")).toBe(
      `http://localhost:8000${prefix}?sayfa=${encodeURIComponent("/arama?q=çakı")}`
    )
    expect(pageUrl("http://localhost:8000", "/tr", "/sepet")).toBe("http://localhost:8000/tr/sepet")
  })

  it("never prints the preview token, plain or encoded", () => {
    const redact = redactor(prefix)
    const message = `page.goto: net::ERR at http://x${prefix}?sayfa=%2F and ${encodeURIComponent(prefix)}`
    expect(redact(message)).not.toContain("secret")
    expect(redact(message)).toContain("<prefix>")
  })

  it("takes the prefix from STYLE_PREFIX, so the token stays off the command line", () => {
    const options = parseCaptureArgs(["--", "--out", "x"], { STYLE_PREFIX: `${prefix}/` })
    expect(options.prefix).toBe(prefix)
    expect(options.widths).toEqual([390, 1440])
    expect(() => parseCaptureArgs([], {})).toThrow(/--out is required/)
    expect(() => parseCaptureArgs(["--out", "x", "--widths", "abc"], {})).toThrow(/--widths/)
  })
})
