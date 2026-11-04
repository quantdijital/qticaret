import { parseCsv } from "../csv"

describe("parseCsv", () => {
  it("maps rows to header names", () => {
    expect(parseCsv("a,b\n1,2\n3,4\n")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ])
  })

  it("handles quotes, escaped quotes, embedded commas and CRLF", () => {
    expect(parseCsv('name,note\r\n"Ak, Saray","say ""merhaba"""\r\n')).toEqual([
      { name: "Ak, Saray", note: 'say "merhaba"' },
    ])
  })

  it("strips a BOM, skips blank lines and fills missing trailing fields", () => {
    expect(parseCsv("﻿a,b,c\n\n1,2")).toEqual([{ a: "1", b: "2", c: "" }])
  })

  it("returns no rows for an empty file", () => {
    expect(parseCsv("")).toEqual([])
  })
})
