import { describe, expect, it } from "vitest"
import { toCsv } from "./csv"

describe("toCsv", () => {
  it("joins with semicolons, starts with a BOM and quotes what needs it", () => {
    expect(
      toCsv([
        ["Ürün", "Tutar"],
        ['Kupa; "büyük"', 12.5],
      ])
    ).toBe('﻿Ürün;Tutar\r\n"Kupa; ""büyük""";12.5')
  })

  it("defuses cells that would start a formula, but not numbers", () => {
    expect(toCsv([["=HYPERLINK(1)", "-5", -5]])).toBe("﻿'=HYPERLINK(1);'-5;-5")
  })
})
