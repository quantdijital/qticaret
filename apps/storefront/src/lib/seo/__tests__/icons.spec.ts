import { describe, expect, it } from "vitest"
import { siteIcons } from "@/lib/seo/icons"

describe("siteIcons: the shop's site icon in <head>", () => {
  it("gives the browser tab and Apple's home screen the shop's PNG", () => {
    expect(siteIcons("https://cdn.magaza.example/simge.png")).toEqual({
      icon: [{ url: "https://cdn.magaza.example/simge.png", type: "image/png" }],
      apple: [{ url: "https://cdn.magaza.example/simge.png" }],
    })
    expect(siteIcons("/static/simge.png")).toEqual({
      icon: [{ url: "/static/simge.png", type: "image/png" }],
      apple: [{ url: "/static/simge.png" }],
    })
  })

  it("names none without one, so app/icon.svg stays the icon", () => {
    for (const value of [null, undefined, "", "   "]) {
      expect(siteIcons(value)).toBeUndefined()
    }
  })

  it("names none for an address the backend would not store", () => {
    for (const value of [
      "http://cdn.magaza.example/simge.png",
      "//evil.example/x.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
    ]) {
      expect(siteIcons(value)).toBeUndefined()
    }
  })
})
