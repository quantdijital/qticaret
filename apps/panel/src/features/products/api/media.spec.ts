import { describe, expect, it } from "vitest"
import { isMediaSettling } from "./media"

const now = new Date().toISOString()
const record = (url: string, extra: object = {}) => ({
  id: `media_${url}`,
  url,
  file_id: `${url}.jpg`,
  alt: null,
  derived_at: now,
  ...extra,
})

describe("whether a product's images are still being taken in", () => {
  it("waits for a record and for versions after a save", () => {
    expect(isMediaSettling({ updated_at: now, images: [{ url: "a" }], media_assets: [] })).toBe(
      true
    )
    expect(
      isMediaSettling({
        updated_at: now,
        images: [{ url: "a" }],
        media_assets: [record("a", { derived_at: null })],
      })
    ).toBe(true)
  })

  it("is done when every image has its record and versions, or has none to make", () => {
    expect(
      isMediaSettling({
        updated_at: now,
        images: [{ url: "a" }, { url: "b" }],
        media_assets: [record("a"), record("b", { file_id: null, derived_at: null })],
      })
    ).toBe(false)
  })

  it("stops looking a while after the save, whatever is missing", () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(isMediaSettling({ updated_at: old, images: [{ url: "a" }], media_assets: [] })).toBe(
      false
    )
  })
})
