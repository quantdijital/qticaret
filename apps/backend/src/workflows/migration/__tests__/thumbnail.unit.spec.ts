import { standInKeyOf, thumbnailChange } from "../thumbnail"

const FEATURED = "https://cdn.example.com/one-cikan.webp"
const GALLERY = "https://cdn.example.com/galeri.webp"
const OWN = "https://cdn.example.com/magazanin.webp"

describe("a moved product's thumbnail (adr/0042 Ek 2026-11-20)", () => {
  it("takes the first picture when it has none", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: null },
        standIn: null,
        first: FEATURED,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({ thumbnail: FEATURED })
  })

  it("records a stand-in when the featured picture could not be fetched", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: null },
        standIn: null,
        first: GALLERY,
        featured: null,
        featuredFailed: true,
      })
    ).toEqual({ thumbnail: GALLERY, standIn: GALLERY })
  })

  it("puts the featured picture in the stand-in's place on a later run, the record cleared", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: GALLERY },
        standIn: GALLERY,
        first: GALLERY,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({ thumbnail: FEATURED, standIn: null })
  })

  it("never replaces one the shop chose since, nor one never recorded", () => {
    expect(
      thumbnailChange({
        current: { thumbnail: OWN },
        standIn: GALLERY,
        first: GALLERY,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({ standIn: null })
    expect(
      thumbnailChange({
        current: { thumbnail: GALLERY },
        standIn: null,
        first: GALLERY,
        featured: FEATURED,
        featuredFailed: false,
      })
    ).toEqual({})
  })

  it("keys its record apart from the product's own", () => {
    expect(standInKeyOf("product:10")).toBe("product:10 thumbnail")
  })
})
