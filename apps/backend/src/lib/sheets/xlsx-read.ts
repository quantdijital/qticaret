import { isValidationError } from "../errors"
import { parseXmlSafely, readZipSafely } from "../security"
import type { ZipEntryData } from "../security"
import type { SheetLimits, SheetRead, SheetRow } from "./types"

/**
 * The first sheet of an xlsx file (adr/0018): the zip and its XML read
 * within the safe readers' limits, cell values only. A formula's cached
 * value is read and the formula never run; a date is read as the number
 * Excel keeps (the template asks for dates as text). What Excel,
 * LibreOffice and Google Sheets write: shared strings, inline strings,
 * numbers, booleans, sparse rows.
 */

// A sheet of 5,000 rows and 60 columns is a few MB of XML; this is well past it
const MAX_SHEET_XML_BYTES = 20 * 1024 * 1024
// A workbook is a few parts; their bytes are kept while the reader works
const XLSX_ZIP_LIMITS = {
  maxEntries: 200,
  maxEntryBytes: MAX_SHEET_XML_BYTES,
  maxTotalBytes: 60 * 1024 * 1024,
  maxRatio: 100,
}
// Counted before anything is parsed into objects: past these it is no sheet a person made
const MAX_CELLS = 600_000
const MAX_STRINGS = 400_000

type Node = Record<string, unknown>

const asNode = (value: unknown): Node =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Node) : {}
const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value]
// An element with attributes (`<t xml:space="preserve">`) parses as `{ "#text": … }`
const textOf = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  return value !== null && typeof value === "object" && "#text" in value
    ? textOf((value as Node)["#text"])
    : ""
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
}
const ENTITY = /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,4});/gi

// The parser leaves entities as written (no DTD, no expansion): the five
// predefined ones and character references are decoded here
function decodeEntities(text: string): string {
  return text.replace(ENTITY, (match, name: string) => {
    if (name.startsWith("#")) {
      const code =
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      // A surrogate half alone is no character (and jsonb refuses it)
      const isSurrogate = code >= 0xd800 && code <= 0xdfff
      return code > 0 && code <= 0x10ffff && !isSurrogate ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? match
  })
}

const ARRAYS = new Set(["sheet", "Relationship", "si", "r", "row", "c"])

function xml(entries: Map<string, Buffer>, name: string, maxBytes?: number): Node | null {
  const data = entries.get(name)
  return data
    ? asNode(
        parseXmlSafely(data.toString("utf8"), {
          keepAttributes: true,
          // A rich text's runs keep the spaces between them
          trimValues: false,
          isArray: (tag) => ARRAYS.has(tag),
          ...(maxBytes ? { maxBytes } : {}),
        })
      )
    : null
}

// A rich text's runs, or its one text; phonetic hints (`rPh`) are no text
function stringItem(item: unknown): string {
  const node = asNode(item)
  const runs = asList(node["r"])
  const text =
    runs.length > 0 ? runs.map((run) => textOf(asNode(run)["t"] ?? "")).join("") : textOf(node["t"])
  return decodeEntities(text)
}

function sharedStrings(entries: Map<string, Buffer>): string[] {
  const doc = xml(entries, "xl/sharedStrings.xml", MAX_SHEET_XML_BYTES)
  return doc ? asList(asNode(doc["sst"])["si"]).map(stringItem) : []
}

/** Where the workbook's first sheet is: `xl/worksheets/sheet1.xml` as a rule. */
function firstSheetPath(entries: Map<string, Buffer>): string | null {
  const workbook = xml(entries, "xl/workbook.xml")
  const [sheet] = asList(asNode(asNode(workbook?.["workbook"])["sheets"])["sheet"])
  const id = textOf(asNode(sheet)["@_r:id"])
  const rels = xml(entries, "xl/_rels/workbook.xml.rels")
  const target = asList(asNode(rels?.["Relationships"])["Relationship"])
    .map(asNode)
    .find((rel) => textOf(rel["@_Id"]) === id)?.["@_Target"]
  const path = textOf(target)
  if (!path) {
    return null
  }
  return path.startsWith("/") ? path.slice(1) : `xl/${path.replace(/^\.\//, "")}`
}

// `AB12` → 27 (zero-based column)
function columnOf(ref: string): number | null {
  const letters = /^([A-Z]{1,3})\d+$/.exec(ref)?.[1]
  if (!letters) {
    return null
  }
  let column = 0
  for (let index = 0; index < letters.length; index += 1) {
    column = column * 26 + letters.charCodeAt(index) - 64
  }
  return column - 1
}

// A float as a person typed it: 19.99, not 19.989999999999998
const numberText = (raw: string): string => {
  const value = Number(raw)
  return Number.isFinite(value) ? String(Number(value.toPrecision(15))) : raw
}

function cellValue(cell: Node, strings: readonly string[]): string {
  const type = textOf(cell["@_t"])
  const value = textOf(cell["v"])
  switch (type) {
    case "s":
      return strings[Number(value)] ?? ""
    case "inlineStr":
      return stringItem(cell["is"])
    case "b":
      return value === "1" ? "TRUE" : value === "0" ? "FALSE" : ""
    case "e":
      return ""
    case "str":
    case "d":
      return decodeEntities(value)
    default:
      return value === "" ? "" : numberText(value)
  }
}

function rowsOf(sheet: Node, strings: readonly string[], limits: SheetLimits): SheetRow[] | string {
  const rows: SheetRow[] = []
  const xmlRows = asList(asNode(asNode(sheet["worksheet"])["sheetData"])["row"])
  for (const [index, item] of xmlRows.entries()) {
    const row = asNode(item)
    const cells: string[] = []
    for (const each of asList(row["c"])) {
      const cell = asNode(each)
      const column = columnOf(textOf(cell["@_r"])) ?? cells.length
      if (column >= limits.maxCells) {
        return "upload.sheet_too_wide"
      }
      while (cells.length < column) {
        cells.push("")
      }
      cells[column] = cellValue(cell, strings).trim()
    }
    if (cells.some((cell) => cell !== "")) {
      rows.push({ line: Number(textOf(row["@_r"])) || index + 1, cells })
      if (rows.length > limits.maxRows + 1) {
        return "upload.sheet_too_many_rows"
      }
    }
  }
  return rows
}

// What the person is told: too big (a bomb, too many parts) or not a workbook
const sheetKey = (key: string): string =>
  /^zip\.(too_large|too_many_entries|ratio_too_high)$|^xml\.too_(large|deep)$/.test(key)
    ? "upload.sheet_too_large"
    : "upload.sheet_invalid"

// `<row`, `<c ` or `<si` elements in the XML, counted without parsing it
function countOf(data: Buffer | undefined, tag: string): number {
  if (!data) {
    return 0
  }
  const text = data.toString("latin1")
  let count = 0
  for (let at = text.indexOf(tag); at !== -1; at = text.indexOf(tag, at + tag.length)) {
    const next = text.charAt(at + tag.length)
    count += next === " " || next === ">" || next === "/" ? 1 : 0
  }
  return count
}

/** Whether the parts are bigger than any sheet a person made: then they are not parsed. */
function tooBig(entries: Map<string, Buffer>, path: string, limits: SheetLimits): string | null {
  const sheet = entries.get(path)
  if (countOf(sheet, "<row") > (limits.maxRows + 1) * 2) {
    return "upload.sheet_too_many_rows"
  }
  return countOf(sheet, "<c") > MAX_CELLS ||
    countOf(entries.get("xl/sharedStrings.xml"), "<si") > MAX_STRINGS
    ? "upload.sheet_too_large"
    : null
}

async function entriesOf(buffer: Buffer): Promise<Map<string, Buffer> | string> {
  let entries: ZipEntryData[]
  try {
    entries = await readZipSafely(buffer, XLSX_ZIP_LIMITS)
  } catch (error) {
    if (isValidationError(error)) {
      return sheetKey(error.safeMessage)
    }
    throw error
  }
  return new Map(entries.map((entry) => [entry.name, entry.data]))
}

/** The first sheet's header and rows; a broken, hostile or oversized file is refused. */
export async function readXlsx(buffer: Buffer, limits: SheetLimits): Promise<SheetRead> {
  const entries = await entriesOf(buffer)
  if (typeof entries === "string") {
    return { ok: false, key: entries }
  }
  try {
    const path = firstSheetPath(entries)
    const big = path ? tooBig(entries, path, limits) : null
    if (big) {
      return { ok: false, key: big }
    }
    const sheet = path ? xml(entries, path, MAX_SHEET_XML_BYTES) : null
    if (!sheet) {
      return { ok: false, key: "upload.sheet_invalid" }
    }
    const rows = rowsOf(sheet, sharedStrings(entries), limits)
    if (typeof rows === "string") {
      return { ok: false, key: rows }
    }
    const [head, ...body] = rows
    return head
      ? { ok: true, header: head.cells.map((cell) => cell.trim()), rows: body }
      : { ok: false, key: "upload.sheet_empty" }
  } catch (error) {
    if (isValidationError(error)) {
      return { ok: false, key: sheetKey(error.safeMessage) }
    }
    throw error
  }
}
