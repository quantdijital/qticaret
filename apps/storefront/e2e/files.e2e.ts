import { expect, test } from "@playwright/test"
import { DEMO_PRODUCT } from "./support"

/**
 * Files, not pages (docs/21): the app's icon and the self-hosted faces
 * are served past the proxy, so they are never resolved nor reported as
 * a 404 to the SEO log. The proxy sets the CSP on everything it handles;
 * a file without one never went through it. (The backend's 404 log itself
 * is not visible from here: the matcher and `isStaticFile` are unit-tested.)
 */
test.describe("files past the proxy", () => {
  test("/icon.svg is the icon, untouched by the proxy", async ({ request }) => {
    const response = await request.get("/icon.svg")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/svg+xml")
    expect(response.headers()["content-security-policy"]).toBeUndefined()
    expect(await response.text()).toContain("<svg")
  })

  test("a page preloads the shop's two faces only, served a year past the proxy", async ({
    page,
    request,
  }) => {
    await page.goto("/")
    const preloads = await page
      .locator('head link[rel="preload"][as="font"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))
    // Two faces of a latin file and a Turkish one each (one face when it draws both)
    expect([2, 4]).toContain(preloads.length)
    for (const href of preloads) {
      expect(href).toMatch(/^\/fonts\/[a-z-]+-(latin|tr)\.[0-9a-f]{10}\.woff2$/)
      const response = await request.get(href)
      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toContain("font/woff2")
      expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable")
      expect(response.headers()["content-security-policy"]).toBeUndefined()
    }
  })

  test("the shop's faces load from their files, Turkish letters included", async ({ page }) => {
    await page.goto(DEMO_PRODUCT)
    const faces = await page
      .locator('head link[rel="preload"][as="font"]')
      .evaluateAll((links) => [
        ...new Set(
          links.map(
            (link) => /\/fonts\/([a-z-]+)-(?:latin|tr)\./.exec(link.getAttribute("href") ?? "")?.[1]
          )
        ),
      ])
    expect(faces.length).toBeGreaterThan(0)
    const loaded = await page.evaluate(async (families) => {
      await document.fonts.ready
      // The Turkish file loads only when one of its letters is drawn: ask for them
      await Promise.all(
        families.map((family) => document.fonts.load(`16px "qt-${family ?? ""}"`, "aĞğİıŞş"))
      )
      return [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replaceAll('"', ""))
    }, faces)
    for (const family of faces) {
      // Both files of the face: its latin one and its Turkish one
      expect(loaded.filter((each) => each === `qt-${family ?? ""}`).length).toBe(2)
    }
  })
})
