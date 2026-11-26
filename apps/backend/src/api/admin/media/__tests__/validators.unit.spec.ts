import { AdminDeleteMediaBatch, AdminGetMedia, AdminUpdateMedia } from "../validators"

const issue = (alt: string) => {
  const parsed = AdminUpdateMedia.safeParse({ alt })
  return parsed.success ? null : parsed.error.issues[0]?.message
}

describe("AdminUpdateMedia alt text", () => {
  it("takes plain words, trims them and clears an empty one", () => {
    expect(AdminUpdateMedia.parse({ alt: "  Mavi zemin üzerinde beyaz kupa  " })).toEqual({
      alt: "Mavi zemin üzerinde beyaz kupa",
    })
    expect(AdminUpdateMedia.parse({ alt: "" })).toEqual({ alt: null })
    expect(AdminUpdateMedia.parse({ alt: null })).toEqual({ alt: null })
    // A dot, a slash or a colon in words is not a link
    expect(issue("Ölçü: 20/30 cm, 1.5 kg")).toBeNull()
  })

  it.each([
    ["<b>Kupa</b>"],
    ["Kupa <img src=x onerror=alert(1)>"],
    ["Kupa > tabak"],
    ["Bkz. https://ornek.com/kupa"],
    ["HTTP://ORNEK.COM"],
    ["www.ornek.com kupası"],
  ])("refuses markup or a link: %s", (alt) => {
    expect(issue(alt)).toBe("media.alt_markup")
  })

  it("keeps refusing control characters with its own key", () => {
    expect(issue("Kupa\u0007")).toBe("media.alt_invalid")
  })
})

describe("the library's views and bulk delete (M1)", () => {
  it("takes the unused and missing alt views, and nothing else", () => {
    expect(AdminGetMedia.parse({ view: "unused" })).toMatchObject({ view: "unused", offset: 0 })
    expect(AdminGetMedia.parse({ view: "missing_alt" })).toMatchObject({ view: "missing_alt" })
    expect(AdminGetMedia.safeParse({ view: "orphans" }).success).toBe(false)
  })

  it("deletes 1–100 pictures by their ids, each once", () => {
    expect(AdminDeleteMediaBatch.parse({ ids: ["media_01JA", "media_01JB"] })).toEqual({
      ids: ["media_01JA", "media_01JB"],
    })
    for (const ids of [
      [],
      ["media_01JA", "media_01JA"],
      ["../etc/passwd"],
      ["prod_01JA"],
      Array.from({ length: 101 }, (_, index) => `media_${String(index)}`),
    ]) {
      expect(AdminDeleteMediaBatch.safeParse({ ids }).success).toBe(false)
    }
    expect(AdminDeleteMediaBatch.safeParse({ ids: ["media_01JA"], force: true }).success).toBe(
      false
    )
  })
})
