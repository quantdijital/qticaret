import { describe, expect, it } from "vitest"
import { readAttributeSuggestions } from "./attribute-values"

describe("readAttributeSuggestions", () => {
  it("keeps values of an attribute's shapes, by key", () => {
    expect(
      readAttributeSuggestions({
        values: { material: "steel", volume: 750, dishwasher: false, colors: ["red", 3, ""] },
        dropped: 2,
      })
    ).toEqual({
      values: { material: "steel", volume: 750, dishwasher: false, colors: ["red"] },
    })
  })

  it("drops what is no value of ours, and an answer without values", () => {
    expect(
      readAttributeSuggestions({
        values: { a: "", b: null, c: { x: 1 }, d: Number.NaN, e: [], constructor: "x" },
      })
    ).toEqual({ values: {} })
    expect(readAttributeSuggestions({ picked: [] })).toBeNull()
    expect(readAttributeSuggestions(null)).toBeNull()
    expect(readAttributeSuggestions("metin")).toBeNull()
  })
})
