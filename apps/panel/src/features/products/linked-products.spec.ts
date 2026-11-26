import { describe, expect, it } from "vitest"
import { LINKED_MAX, moved, withAdded } from "./linked-products"

describe("linked products (S3)", () => {
  it("moves a row up, down and by drag; out of range leaves the list", () => {
    expect(moved(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"])
    expect(moved(["a", "b"], 1, 2)).toEqual(["a", "b"])
    expect(moved(["a", "b"], -1, 0)).toEqual(["a", "b"])
  })

  it("adds a product once, never past the limit", () => {
    const a = { id: "prod_a" }
    expect(withAdded([a], { id: "prod_b" })).toEqual([a, { id: "prod_b" }])
    expect(withAdded([a], { id: "prod_a" })).toEqual([a])
    const full = Array.from({ length: LINKED_MAX }, (_, i) => ({ id: `prod_${String(i)}` }))
    expect(withAdded(full, { id: "prod_new" })).toHaveLength(LINKED_MAX)
  })
})
