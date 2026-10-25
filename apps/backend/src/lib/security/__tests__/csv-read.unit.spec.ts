import { CSV_BOM, toCsv } from "../csv"
import { readCsv } from "../csv-read"

const limits = { maxRows: 10, maxCells: 8 }

describe("readCsv", () => {
  it("reads what toCsv writes, with either delimiter and the BOM", () => {
    const rows = [
      ["source", "target"],
      ["/eski;yol", 'say "merhaba"'],
      ["/satir\nsonu", ""],
    ]
    for (const delimiter of [",", ";"] as const) {
      const read = readCsv(`${CSV_BOM}${toCsv(rows, delimiter)}`, limits)
      expect(read).toEqual({
        ok: true,
        header: ["source", "target"],
        rows: [
          { line: 2, cells: ["/eski;yol", 'say "merhaba"'] },
          { line: 3, cells: ["/satir\nsonu", ""] },
        ],
      })
    }
  })

  it("skips blank lines and numbers rows by the line they start on", () => {
    const read = readCsv("Source,Target\n\n/a,/b\r\n/c,/d", limits)
    expect(read).toMatchObject({
      header: ["source", "target"],
      rows: [
        { line: 3, cells: ["/a", "/b"] },
        { line: 4, cells: ["/c", "/d"] },
      ],
    })
  })

  it.each([
    ['source\n"açık', "upload.csv_invalid"],
    ["", "upload.csv_empty"],
    [`a\n${"x\n".repeat(11)}`, "upload.csv_too_many_rows"],
    [`${"a,".repeat(9)}a`, "upload.csv_too_wide"],
  ])("refuses a broken or oversized file", (text, key) => {
    expect(readCsv(text, limits)).toEqual({ ok: false, key })
  })
})
