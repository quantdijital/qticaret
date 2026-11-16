import { describe, expect, it } from "vitest"
import { siteIcons } from "@/lib/seo/icons"

const PNG = "https://cdn.magaza.example/simge.png"
const SVG = "https://cdn.magaza.example/simge.svg"
const TOUCH = "https://cdn.magaza.example/apple-touch.png"

describe("siteIcons: the shop's site icon in <head>", () => {
  it("gives the browser tab and Apple's home screen the shop's PNG", () => {
    expect(
      siteIcons({ favicon_url: PNG, favicon_type: "image/png", apple_touch_url: PNG })
    ).toEqual({
      icon: [{ url: PNG, type: "image/png" }],
      apple: [{ url: PNG }],
    })
    // From a backend before the type: a PNG
    expect(siteIcons({ favicon_url: "/static/simge.png" })).toEqual({
      icon: [{ url: "/static/simge.png", type: "image/png" }],
    })
  })

  it("names an SVG as one, and Apple's icon only as the backend's PNG of it", () => {
    expect(
      siteIcons({ favicon_url: SVG, favicon_type: "image/svg+xml", apple_touch_url: TOUCH })
    ).toEqual({
      icon: [{ url: SVG, type: "image/svg+xml" }],
      apple: [{ url: TOUCH }],
    })
    // No PNG could be made: no Apple icon, as before there was a site icon
    expect(
      siteIcons({ favicon_url: SVG, favicon_type: "image/svg+xml", apple_touch_url: null })
    ).toEqual({ icon: [{ url: SVG, type: "image/svg+xml" }] })
  })

  it("names none without one, so app/icon.svg stays the icon", () => {
    for (const value of [null, undefined, "", "   "]) {
      expect(siteIcons({ favicon_url: value })).toBeUndefined()
    }
  })

  it("names none for an address the backend would not store, and no type it does not know", () => {
    for (const value of [
      "http://cdn.magaza.example/simge.png",
      "//evil.example/x.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
    ]) {
      expect(siteIcons({ favicon_url: value })).toBeUndefined()
    }
    expect(
      siteIcons({
        favicon_url: PNG,
        favicon_type: "text/html",
        apple_touch_url: "javascript:alert(1)",
      })
    ).toEqual({ icon: [{ url: PNG, type: "image/png" }] })
  })
})
