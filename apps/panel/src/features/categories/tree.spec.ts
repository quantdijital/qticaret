import { describe, expect, it } from "vitest"
import type { Category } from "./api/categories"
import {
  ancestorHandles,
  ancestorNames,
  descendantsOf,
  matchingCategories,
  siblingFor,
  treeRows,
} from "./tree"

const category = (id: string, parent: string | null, rank: number, handle = id) =>
  ({ id, name: id, handle, parent_category_id: parent, rank }) as unknown as Category

const giyim = category("giyim", null, 1)
const ev = category("ev", null, 0)
const all = [
  giyim,
  ev,
  category("gomlek", "giyim", 0),
  category("keten", "gomlek", 0),
  category("mutfak", "ev", 0),
]

describe("category tree", () => {
  it("draws rows in rank order with depth, and hides collapsed subtrees", () => {
    expect(
      treeRows(all, new Set()).map((row) => `${row.category.id}:${String(row.depth)}`)
    ).toEqual(["ev:0", "mutfak:1", "giyim:0", "gomlek:1", "keten:2"])
    expect(treeRows(all, new Set(["giyim"])).map((row) => row.category.id)).toEqual([
      "ev",
      "mutfak",
      "giyim",
    ])
  })

  it("finds descendants and the path of ancestors", () => {
    expect([...descendantsOf(all, "giyim")].sort()).toEqual(["gomlek", "keten"])
    expect(ancestorHandles(all, "gomlek")).toEqual(["giyim", "gomlek"])
    expect(ancestorHandles(all, null)).toEqual([])
  })

  it("finds the sibling to swap with, none at the ends", () => {
    expect(siblingFor(all, giyim, -1)?.id).toBe("ev")
    expect(siblingFor(all, ev, -1)).toBeUndefined()
  })

  it("finds categories by name or address in the tree's order, with their parents' names", () => {
    const keten = all.find((item) => item.id === "keten")
    if (!keten) {
      throw new Error("no keten")
    }
    expect(matchingCategories(all, "  E ").map((item) => item.id)).toEqual([
      "ev",
      "gomlek",
      "keten",
    ])
    expect(matchingCategories(all, " ")).toEqual([])
    expect(ancestorNames(all, keten)).toEqual(["giyim", "gomlek"])
    expect(ancestorNames(all, giyim)).toEqual([])
  })
})
