import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Readable } from "node:stream"
import yazl from "yazl"
import { readSheet, readXlsx, sheetFormatOf, writeXlsx } from ".."
import type { SheetRead } from ".."

const LIMITS = { maxRows: 100, maxCells: 50 }
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name))

async function bytesOf(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

const rowsOf = (read: SheetRead) => {
  if (!read.ok) {
    throw new Error(read.key)
  }
  return read
}

// A one-sheet xlsx with this sheet XML, as a hostile or odd file would be
async function xlsxWith(sheetXml: string): Promise<Buffer> {
  const zip = new yazl.ZipFile()
  zip.addBuffer(
    Buffer.from(
      '<workbook xmlns:r="r"><sheets><sheet name="a" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    "xl/workbook.xml"
  )
  zip.addBuffer(
    Buffer.from(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
    ),
    "xl/_rels/workbook.xml.rels"
  )
  zip.addBuffer(Buffer.from(sheetXml), "xl/worksheets/sheet1.xml")
  zip.end()
  return bytesOf(zip.outputStream as Readable)
}

describe("reading xlsx", () => {
  it.each(["openpyxl.xlsx", "shared-strings.xlsx"])(
    "reads the first sheet of %s: text, numbers, booleans, rich text and gaps",
    async (name) => {
      const read = rowsOf(await readXlsx(fixture(name), LIMITS))
      expect(read.header).toEqual(["Tanıtıcı", "Ürün adı", "Fiyat (TRY)", "Stok", "Yayında", "Not"])
      expect(read.rows).toEqual([
        {
          line: 2,
          cells: ["seramik-kupa", "Seramik Kupa — Ev & Yaşam <özel>", "19.99", "5", "TRUE", "ilk"],
        },
        { line: 3, cells: ["celik-tava", "Çelik Tava", "1250", "0", "FALSE"] },
        { line: 5, cells: ["bosluklu-satir", "Kalın ve düz", "", "", "", "boşluklu"] },
      ])
    }
  )

  it("reads a formula's cached value and a float as it was typed", async () => {
    const read = rowsOf(await readXlsx(fixture("excel-formula.xlsx"), LIMITS))
    expect(read.rows).toEqual([{ line: 2, cells: ["Kupa", "19.99", "39.98"] }])
  })

  it("refuses a document type, and a sheet past the limits", async () => {
    expect(
      await readXlsx(await xlsxWith('<!DOCTYPE x [<!ENTITY e "x">]><worksheet/>'), LIMITS)
    ).toEqual({ ok: false, key: "upload.sheet_invalid" })
    const rows = Array.from(
      { length: 5 },
      (_, index) => `<row r="${String(index + 1)}"><c r="A${String(index + 1)}"><v>1</v></c></row>`
    ).join("")
    const many = await xlsxWith(`<worksheet><sheetData>${rows}</sheetData></worksheet>`)
    expect(await readXlsx(many, { maxRows: 3, maxCells: 5 })).toEqual({
      ok: false,
      key: "upload.sheet_too_many_rows",
    })
    const wide = await xlsxWith(
      '<worksheet><sheetData><row r="1"><c r="Z1"><v>1</v></c></row></sheetData></worksheet>'
    )
    expect(await readXlsx(wide, { maxRows: 3, maxCells: 5 })).toEqual({
      ok: false,
      key: "upload.sheet_too_wide",
    })
  })

  it("refuses a zip that is no workbook", async () => {
    const zip = new yazl.ZipFile()
    zip.addBuffer(Buffer.from("x"), "readme.txt")
    zip.end()
    expect(await readXlsx(await bytesOf(zip.outputStream as Readable), LIMITS)).toEqual({
      ok: false,
      key: "upload.sheet_invalid",
    })
  })
})

describe("writing xlsx", () => {
  it("writes what it reads back, formulas escaped and characters XML cannot hold left out", async () => {
    const bytes = await bytesOf(
      writeXlsx([
        {
          name: "Ürünler",
          widths: [20, 30],
          rows: [
            ["Tanıtıcı", "Ad", "Fiyat"],
            ["kupa", '=HYPERLINK("x")', 19.99],
            ["tava", "Ev & Yaşam <b>\u0007", null],
          ],
        },
        { name: "Nasıl doldurulur?", rows: [["okunmaz"]] },
      ])
    )
    expect(sheetFormatOf(bytes)).toBe("xlsx")
    const read = rowsOf(await readXlsx(bytes, LIMITS))
    expect(read.header).toEqual(["Tanıtıcı", "Ad", "Fiyat"])
    expect(read.rows).toEqual([
      { line: 2, cells: ["kupa", '\'=HYPERLINK("x")', "19.99"] },
      { line: 3, cells: ["tava", "Ev & Yaşam <b>"] },
    ])
    // `readSheet` gives it back as it was before the export
    const back = await readSheet(bytes, LIMITS)
    expect(back.ok && back.rows[0]?.cells[1]).toBe('=HYPERLINK("x")')
  })
})

describe("reading CSV", () => {
  it("reads UTF-8 with a BOM, and the Windows-1254 Turkish Excel saves", async () => {
    const utf8 = rowsOf(await readSheet(Buffer.from("﻿Tanıtıcı;Ad\nkupa;Çelik Şişe\n"), LIMITS))
    expect(utf8.rows).toEqual([{ line: 2, cells: ["kupa", "Çelik Şişe"] }])
    // "Çelik Şişe" in Windows-1254: Ç C7, Ş DE, i 69, ş FE, e 65
    const legacy = Buffer.concat([
      Buffer.from("Tanitici;Ad\nkupa;"),
      Buffer.from([0xc7, 0x65, 0x6c, 0x69, 0x6b, 0x20, 0xde, 0x69, 0xfe, 0x65, 0x0a]),
    ])
    expect(rowsOf(await readSheet(legacy, LIMITS)).rows[0]?.cells[1]).toBe("Çelik Şişe")
  })

  it("refuses bytes that are neither", async () => {
    expect(await readSheet(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]), LIMITS)).toEqual({
      ok: false,
      key: "upload.sheet_invalid",
    })
  })
})
