import { isValidationError } from "../../../lib/errors"
import { handleOf } from "../handle"

/** The owner, 2026-11-04: a content save asks only a title; the address is made, not refused. */
describe("a content entry's handle", () => {
  it("is the title's when nothing is typed", () => {
    expect(handleOf(undefined, "Kargo ve Teslimat")).toBe("kargo-ve-teslimat")
    expect(handleOf("  ", "Hakkımızda")).toBe("hakkimizda")
  })

  it("is what was typed, made a slug as a title would be", () => {
    expect(handleOf("iade-politikasi", "Başka")).toBe("iade-politikasi")
    expect(handleOf("İade Politikası", "Başka")).toBe("iade-politikasi")
    expect(handleOf("/sss/", "Başka")).toBe("sss")
  })

  it("falls back to the title when what was typed has no letter, and is refused only with none", () => {
    expect(handleOf("2026", "Yeni sezon")).toBe("yeni-sezon")
    let thrown: unknown
    try {
      handleOf("", "2026")
    } catch (error) {
      thrown = error
    }
    expect(isValidationError(thrown)).toBe(true)
    expect(thrown).toMatchObject({ safeMessage: "catalog.handle_required", field: "handle" })
  })
})
