import { describe, expect, it } from "vitest"
import { brandStyle, readableOn } from "../color"

describe("brand colour", () => {
  it("puts white on a dark colour and ink on a light one", () => {
    expect(readableOn("#0b5c99")).toBe("#ffffff")
    expect(readableOn("#f5d90a")).toBe("#111113")
  })

  it("gives the tokens for a hex colour and nothing for anything else", () => {
    expect(brandStyle("#0b5c99")).toBe(
      ":root{--primary:#0b5c99;--primary-foreground:#ffffff;--ring:#0b5c99;--announcement:#0b5c99;--announcement-foreground:#ffffff}"
    )
    expect(brandStyle(null)).toBeNull()
    expect(brandStyle("red;}body{display:none")).toBeNull()
    expect(brandStyle("#0B5C99")).toBeNull()
  })
})
