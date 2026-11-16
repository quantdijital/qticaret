import {
  AdminPostStorefrontDesign,
  AdminPostStorefrontDesignApply,
  designIdOf,
  designName,
} from "../validators"

const messages = (value: unknown) => {
  const parsed = designName.safeParse(value)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

describe("a saved look's request (adr/0064 Ek 2026-11-17)", () => {
  it("takes a name of 1–60 characters, trimmed", () => {
    expect(designName.parse("  Kış vitrini ")).toBe("Kış vitrini")
    expect(designName.parse("x".repeat(60))).toHaveLength(60)
  })

  it("refuses an empty, long or unclean name with the one key the panel shows", () => {
    for (const wrong of ["", "   ", "x".repeat(61), "a\u0000b"]) {
      expect(messages(wrong)).toEqual(["storefront_design.name_invalid"])
    }
  })

  it("refuses a name carrying invisible format characters", () => {
    const formats = [
      "​", // zero-width space
      "‍", // zero-width joiner
      "‎", // left-to-right mark
      "‏", // right-to-left mark
      "‪", // left-to-right embedding
      "‮", // right-to-left override
      "⁦", // left-to-right isolate
      "⁩", // pop directional isolate
      "﻿", // byte order mark
      "­", // soft hyphen
    ]
    for (const format of formats) {
      expect(messages(`Kış${format}vitrini`)).toEqual(["storefront_design.name_invalid"])
    }
    // The line and paragraph separators break the name's line wherever it is shown
    for (const separator of [" ", " "]) {
      expect(messages(`Kış${separator}vitrini`)).toEqual(["storefront_design.name_invalid"])
    }
    // A BOM at the edge is whitespace to `trim` and never reaches the store.
    expect(designName.parse("﻿Kış")).toBe("Kış")
  })

  it("keeps letters, marks and emoji that are not format characters", () => {
    for (const name of ["Çiçek İğne Şık", "Été ⚡", "Yaz ☀️", "東京 vitrin"]) {
      expect(designName.parse(name)).toBe(name)
    }
  })

  it("takes no document, only a name and a kept publication's number", () => {
    expect(AdminPostStorefrontDesign.safeParse({ name: "A", revision: 3 }).success).toBe(true)
    expect(
      AdminPostStorefrontDesign.safeParse({ name: "A", revision: 2_147_483_647 }).success
    ).toBe(true)
    for (const wrong of [
      { name: "A", document: {} },
      { name: "A", revision: 0 },
      { name: "A", revision: 1.5 },
      { name: "A", revision: 2_147_483_648 },
    ]) {
      expect(AdminPostStorefrontDesign.safeParse(wrong).success).toBe(false)
    }
    expect(AdminPostStorefrontDesignApply.safeParse({}).success).toBe(true)
    expect(AdminPostStorefrontDesignApply.safeParse({ save_as: "" }).success).toBe(false)
  })

  it("reads an id not shaped as a look's as a look that does not exist", () => {
    expect(designIdOf({ id: "sfd_01ABC" })).toBe("sfd_01ABC")
    for (const params of [{ id: "prod_01ABC" }, { id: "sfd_../x" }, {}]) {
      expect(() => designIdOf(params)).toThrow("storefront_design.unknown")
    }
  })
})
