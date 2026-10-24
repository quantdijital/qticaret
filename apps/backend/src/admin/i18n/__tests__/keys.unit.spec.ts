import en from "../en.json"
import tr from "../tr.json"

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

describe("admin translations", () => {
  it("define the same keys in Turkish and English", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(tr).sort())
  })

  it("keep every key under the qticaret namespace prefix", () => {
    expect(Object.keys(tr)).toEqual(["qticaret"])
    expect(Object.keys(en)).toEqual(["qticaret"])
  })

  it("have no empty strings", () => {
    const strings = (value: unknown): unknown[] =>
      typeof value === "object" && value !== null ? Object.values(value).flatMap(strings) : [value]
    for (const text of [...strings(tr), ...strings(en)]) {
      expect(typeof text === "string" && text.trim().length > 0).toBe(true)
    }
  })
})
