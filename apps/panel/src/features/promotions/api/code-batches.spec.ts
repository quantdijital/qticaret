import { describe, expect, it } from "vitest"
import { codeCountOf } from "./code-batches"

describe("codeCountOf", () => {
  it.each([
    ["100", 100],
    [" 1 ", 1],
    ["10000", 10_000],
    ["0", null],
    ["10001", null],
    ["12,5", null],
    ["", null],
    ["1e3", null],
  ])("%s is %s", (text, expected) => {
    expect(codeCountOf(text)).toBe(expected)
  })
})
