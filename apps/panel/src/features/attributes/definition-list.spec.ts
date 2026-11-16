import { describe, expect, it } from "vitest"
import { advancedChanges, dropIndex, followMove, followRemove } from "./definition-list"
import { emptyDefinition } from "./form"

describe("dropIndex", () => {
  it("lands a row before or after another, counting the place it leaves", () => {
    // Down: the dragged row's own place closes up
    expect(dropIndex(0, 2, "after")).toBe(2)
    expect(dropIndex(0, 2, "before")).toBe(1)
    // Up
    expect(dropIndex(3, 1, "before")).toBe(1)
    expect(dropIndex(3, 1, "after")).toBe(2)
    // Onto its neighbour's near half: where it is
    expect(dropIndex(1, 2, "before")).toBe(1)
  })
})

describe("followMove / followRemove", () => {
  it("keeps the same row open while rows move", () => {
    expect(followMove(null, 0, 2)).toBeNull()
    expect(followMove(1, 1, 3)).toBe(3)
    expect(followMove(2, 0, 3)).toBe(1)
    expect(followMove(2, 4, 0)).toBe(3)
    expect(followMove(2, 3, 4)).toBe(2)
  })

  it("closes the removed row and follows the others", () => {
    expect(followRemove(2, 2)).toBeNull()
    expect(followRemove(3, 1)).toBe(2)
    expect(followRemove(1, 3)).toBe(1)
    expect(followRemove(null, 0)).toBeNull()
  })
})

describe("advancedChanges", () => {
  it("counts the advanced settings set apart from their defaults", () => {
    expect(advancedChanges(emptyDefinition())).toBe(0)
    expect(
      advancedChanges({ ...emptyDefinition(), aliases: ["Üretim yeri"], is_seo_highlight: true })
    ).toBe(2)
    expect(advancedChanges({ ...emptyDefinition(), unit: "HRC" })).toBe(1)
    // A number's unit is an everyday field
    expect(advancedChanges({ ...emptyDefinition(), type: "number", unit: "cm" })).toBe(0)
    // A product option: its scope and Google's word; other names are not kept for it
    expect(
      advancedChanges({
        ...emptyDefinition(),
        scope: "variant",
        varies_by: "size",
        aliases: ["Ölçü"],
      })
    ).toBe(2)
    // A hidden attribute's title word is not saved
    expect(
      advancedChanges({ ...emptyDefinition(), is_public: false, is_seo_highlight: true })
    ).toBe(0)
  })
})
