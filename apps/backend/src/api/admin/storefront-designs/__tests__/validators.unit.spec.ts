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

  it("takes no document, only a name and a kept publication's number", () => {
    expect(AdminPostStorefrontDesign.safeParse({ name: "A", revision: 3 }).success).toBe(true)
    for (const wrong of [
      { name: "A", document: {} },
      { name: "A", revision: 0 },
      { name: "A", revision: 1.5 },
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
