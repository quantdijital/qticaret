import { definitionInput, groupsInput, groupsOf, strayGroups } from "../validation"

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

// adr/0013 Ek 2026-11-04: a template's spec table sections
describe("attribute groups", () => {
  const blade = { key: "blade", name: "Bıçak", rank: 0 }
  const handle = { key: "handle", name: "Sap", rank: 1 }

  it("takes named sections with their places, a key once", () => {
    expect(groupsInput.safeParse([blade, handle]).success).toBe(true)
    expect(groupsInput.safeParse([]).success).toBe(true)
    expect(messages(groupsInput.safeParse([blade, { ...handle, key: "blade" }]))).toContain(
      "product_attributes.groups_duplicate"
    )
  })

  it.each([
    ["an upper-case key", { ...blade, key: "Blade" }],
    ["a key with a space", { ...blade, key: "blade length" }],
    ["an empty name", { ...blade, name: " " }],
    ["a name with a control character", { ...blade, name: "Bı\u0007çak" }],
    ["a negative place", { ...blade, rank: -1 }],
    ["an unknown field", { ...blade, colour: "red" }],
  ])("refuses %s", (_label, group) => {
    expect(groupsInput.safeParse([group]).success).toBe(false)
  })

  it("lets a definition name its section, or none, or leave it as it was", () => {
    const base = { key: "length", label: "Uzunluk", type: "number" as const }
    expect(definitionInput.parse({ ...base, group: "blade" }).group).toBe("blade")
    expect(definitionInput.parse({ ...base, group: null }).group).toBeNull()
    expect(definitionInput.parse(base).group).toBeUndefined()
    expect(definitionInput.safeParse({ ...base, group: "Not A Key" }).success).toBe(false)
  })

  it("finds definitions naming a section the template does not have", () => {
    expect(
      strayGroups([{ group: "blade" }, { group: null }, {}, { group: "steel" }], [blade, handle])
    ).toEqual(["steel"])
    expect(strayGroups([{ group: "blade" }], [])).toEqual(["blade"])
  })

  it("reads stored sections, and anything else as none", () => {
    expect(groupsOf([blade])).toEqual([blade])
    expect(groupsOf(null)).toEqual([])
    expect(groupsOf({ items: [blade] })).toEqual([])
  })
})
