import { THUMBNAIL_STAND_IN, thumbnailChange } from "../thumbnail"

const FEATURED = "https://cdn.example.com/one-cikan.webp"
const GALLERY = "https://cdn.example.com/galeri.webp"
const OWN = "https://cdn.example.com/magazanin.webp"

describe("a moved product's thumbnail (adr/0042 Ek 2026-11-20)", () => {
  it("takes the first picture when it has none", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: null, metadata: null },
        first: FEATURED,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({ thumbnail: FEATURED })
  })

  it("marks a stand-in when the featured picture could not be fetched", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: null, metadata: { kaynak: "wp" } },
        first: GALLERY,
        featured: null,
        featuredFailed: true,
      })
    ).toEqual({ thumbnail: GALLERY, metadata: { kaynak: "wp", [THUMBNAIL_STAND_IN]: GALLERY } })
  })

  it("puts the featured picture in the stand-in's place on a later run", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: GALLERY, metadata: { kaynak: "wp", [THUMBNAIL_STAND_IN]: GALLERY } },
        first: GALLERY,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({ thumbnail: FEATURED, metadata: { kaynak: "wp", [THUMBNAIL_STAND_IN]: null } })
  })

  it("never replaces one the shop chose since, nor one never marked", () => {
    for (const current of [
      { thumbnail: OWN, metadata: { [THUMBNAIL_STAND_IN]: GALLERY } },
      { thumbnail: GALLERY, metadata: null },
    ]) {
      expect(
        thumbnailChange({ current, first: GALLERY, featured: FEATURED, featuredFailed: false })
      ).toEqual({})
    }
  })
})
