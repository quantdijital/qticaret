import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server"
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config"

const headersAt = async (pathname: string) =>
  (
    await unstable_getResponseFromNextConfig({
      url: `http://localhost:8000${pathname}`,
      nextConfig,
    })
  ).headers

const IMAGE_FILE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

/** adr/0053 Ek 2026-11-15, second review: an SVG opened on its own runs and loads nothing. */
describe("the served image files' own CSP", () => {
  it("is set on the providers' marks and the app's icon", async () => {
    for (const path of ["/marks/visa.png", "/marks/aras.svg", "/icon.svg"]) {
      expect((await headersAt(path)).get("content-security-policy"), path).toBe(IMAGE_FILE_CSP)
    }
  })

  it("is not a page's: the proxy sets those", async () => {
    for (const path of [
      "/",
      "/urun/keten-gomlek",
      "/marks",
      "/fonts/inter-latin.c940764593.woff2",
    ]) {
      expect((await headersAt(path)).get("content-security-policy"), path).toBeNull()
    }
  })
})
