import { describe, expect, it } from "vitest"
import { allToggled, movedOpen, removedOpen, toggledOpen } from "./program-open"

const sorted = (open: ReadonlySet<number>) => [...open].sort((a, b) => a - b)

describe("program-open", () => {
  it("opens and folds one step", () => {
    expect(sorted(toggledOpen(new Set([1]), 2))).toEqual([1, 2])
    expect(sorted(toggledOpen(new Set([1, 2]), 1))).toEqual([2])
  })

  it("keeps a moved step open and shifts the ones between", () => {
    // 0 open moves to the end: the others move up one
    expect(sorted(movedOpen(new Set([0]), 4, 0, 3))).toEqual([3])
    expect(sorted(movedOpen(new Set([1, 3]), 4, 3, 0))).toEqual([0, 2])
    expect(sorted(movedOpen(new Set([2]), 3, 0, 1))).toEqual([2])
  })

  it("moves the open steps after a removed one up", () => {
    expect(sorted(removedOpen(new Set([0, 2, 3]), 2))).toEqual([0, 2])
    expect(sorted(removedOpen(new Set([1]), 0))).toEqual([0])
  })

  it("opens every step, or folds them all when all are open", () => {
    expect(sorted(allToggled(new Set([1]), 3))).toEqual([0, 1, 2])
    expect(sorted(allToggled(new Set([0, 1, 2]), 3))).toEqual([])
    expect(sorted(allToggled(new Set(), 0))).toEqual([])
  })
})
