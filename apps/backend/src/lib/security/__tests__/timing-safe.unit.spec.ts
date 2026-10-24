import { safeEqual } from "../timing-safe"

describe("safeEqual", () => {
  it("is true for equal strings and buffers", () => {
    expect(safeEqual("signature-abc", "signature-abc")).toBe(true)
    expect(safeEqual(Buffer.from("abc"), "abc")).toBe(true)
  })

  it("is false for different values of the same length", () => {
    expect(safeEqual("signature-abc", "signature-abd")).toBe(false)
  })

  it("is false, without throwing, for different lengths", () => {
    expect(safeEqual("short", "a much longer value")).toBe(false)
    expect(safeEqual("", "x")).toBe(false)
  })

  it("never matches an empty expected value, a missing secret", () => {
    expect(safeEqual("", "")).toBe(false)
    expect(safeEqual("anything", "")).toBe(false)
  })
})
