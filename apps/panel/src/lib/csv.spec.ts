import { describe, expect, it } from "vitest"
import { escapeCsvCell, toCsv } from "./csv"

// The server's table (apps/backend/src/lib/security/__tests__/files.unit.spec.ts)
describe("escapeCsvCell", () => {
  it.each([
    ["a formula", '=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ["a plus", "+905321234567", "'+905321234567"],
    ["a minus text", "-2+3", "'-2+3"],
    ["an at sign", "@SUM(A1)", "'@SUM(A1)"],
    ["a leading tab", "\tcmd", '"\'\tcmd"'],
    ["a formula after a semicolon (Excel in a Turkish locale)", "x;=1+1;", '"x;\'=1+1;"'],
    ["a formula after a comma and spaces", "a, @SUM(A1)", '"a, \'@SUM(A1)"'],
    ["a formula after a leading space", " =1", '" \'=1"'],
    ["a formula after a no-break space", " =1", '" \'=1"'],
    ["a fullwidth equals sign", "＝1+1", "'＝1+1"],
    ["a minus inside a word", "Ali-Veli", "Ali-Veli"],
    ["a comma", "a,b", '"a,b"'],
    ["a line break", "a\nb", '"a\nb"'],
    ["plain text", "Şef Bıçağı", "Şef Bıçağı"],
    ["a negative number, kept a number", -5, "-5"],
    ["null", null, ""],
  ])("handles %s", (_label, value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected)
  })
})

describe("toCsv", () => {
  it("starts with a BOM, joins with semicolons and ends rows with CRLF", () => {
    expect(
      toCsv([
        ["Ürün", "Tutar"],
        ["Kupa", 12.5],
      ])
    ).toBe("﻿Ürün;Tutar\r\nKupa;12.5\r\n")
  })
})
