import { describe, expect, it } from "vitest"
import { landingOf, readLanding } from "../landing"

describe("landingOf", () => {
  it("keeps the campaign words, whether an ad click id came, another site's page", () => {
    const url = new URL("https://shop.example/urun/a?utm_source=google&utm_medium=cpc&gclid=abc123")
    expect(landingOf(url, "https://news.example/story?id=9")).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      gclid: true,
      referrer: "https://news.example/story",
    })
  })

  it("says nothing for a direct visit or one from our own pages", () => {
    const url = new URL("https://shop.example/")
    expect(landingOf(url, null)).toBeNull()
    expect(landingOf(url, "https://shop.example/kategori/a")).toBeNull()
  })

  it("drops a campaign word that is not one, and reads back what it wrote", () => {
    const url = new URL("https://shop.example/?utm_source=%3Cscript%3E")
    expect(landingOf(url, null)).toBeNull()
    const value = encodeURIComponent(JSON.stringify({ utm_source: "x" }))
    expect(readLanding(value)).toEqual({ utm_source: "x" })
    expect(readLanding("%%%")).toBeNull()
  })
})
