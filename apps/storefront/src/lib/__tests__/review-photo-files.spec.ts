import { describe, expect, it } from "vitest"
import { reviewPhotoFiles } from "@/lib/reviews/photos"

const file = (name: string, type: string, size = 100) =>
  new File([new Uint8Array(size)], name, { type })

const formWith = (...files: File[]) => {
  const form = new FormData()
  for (const each of files) {
    form.append("photos", each)
  }
  return form
}

// adr/0037 §4 Ek 2026-11-04: a review form's photos, before any round trip
describe("reviewPhotoFiles", () => {
  it("takes up to three images and reads an empty file input as none", () => {
    expect(
      reviewPhotoFiles(formWith(file("a.jpg", "image/jpeg"), file("b.png", "image/png")))
    ).toHaveLength(2)
    expect(reviewPhotoFiles(formWith(file("", "application/octet-stream", 0)))).toEqual([])
    expect(reviewPhotoFiles(new FormData())).toEqual([])
  })

  it("refuses a fourth photo, another type and one over 10 MB", () => {
    const four = Array.from({ length: 4 }, (_, index) => file(`${String(index)}.jpg`, "image/jpeg"))
    expect(reviewPhotoFiles(formWith(...four))).toBeNull()
    expect(reviewPhotoFiles(formWith(file("x.svg", "image/svg+xml")))).toBeNull()
    expect(reviewPhotoFiles(formWith(file("x.pdf", "application/pdf")))).toBeNull()
    expect(
      reviewPhotoFiles(formWith(file("big.jpg", "image/jpeg", 10 * 1024 * 1024 + 1)))
    ).toBeNull()
  })
})
