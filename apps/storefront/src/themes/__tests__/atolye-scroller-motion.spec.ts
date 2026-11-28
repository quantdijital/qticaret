import { describe, expect, it } from "vitest"
import {
  cardStride,
  stepTarget,
} from "../../../../../packages/themes/atolye/src/parts/scroller-motion"

/** A row 1000 px in view, 3000 px long, standing where it is told. */
const track = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 3000, clientWidth: 1000 })

/** A row whose cards start at the given offsets. */
const row = (offsets: number[]) =>
  Object.assign(track(0), {
    children: offsets.map((offsetLeft) => ({ offsetLeft })) as unknown as HTMLCollection,
  })

describe("the scroller's steps", () => {
  it("steps a page by default, back to the start at the end when it loops", () => {
    expect(stepTarget(track(0), 1, true)).toBe(1000)
    expect(stepTarget(track(1500), 1, false)).toBe(2000)
    expect(stepTarget(track(2000), 1, true)).toBe(0)
    expect(stepTarget(track(2000), 1, false)).toBe(2000)
    expect(stepTarget(track(0), -1, true)).toBe(2000)
  })

  it("steps one card when given a card's stride, never past the end", () => {
    expect(stepTarget(track(0), 1, true, 260)).toBe(260)
    expect(stepTarget(track(1900), 1, true, 260)).toBe(2000)
    expect(stepTarget(track(2000), 1, true, 260)).toBe(0)
  })

  it("takes a card's stride from the first card to the second, else a page", () => {
    expect(cardStride(row([16, 276, 536]))).toBe(260)
    expect(cardStride(row([16]))).toBe(1000)
    expect(cardStride(row([0, 0]))).toBe(1000)
  })
})
