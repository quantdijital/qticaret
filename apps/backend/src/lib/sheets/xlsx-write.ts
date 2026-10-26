import { Readable } from "node:stream"
import yazl from "yazl"
import { escapeFormulaStart } from "../security"

/**
 * The smallest xlsx Excel, LibreOffice and Google Sheets open (adr/0018):
 * inline strings and numbers, a bold, frozen header row, column widths.
 * Rows stream into the zip, so an export of 50,000 rows is never whole in
 * memory. Text that starts like a formula gets an apostrophe (docs/04;
 * a cell has no delimiters, so only its start counts), and characters XML
 * cannot hold are left out. A row source that fails fails the stream.
 */

export type SheetCell = string | number | null

export interface SheetSpec {
  /** Up to 31 characters; `[]:*?/\` are taken out. */
  name: string
  /** The header first. */
  rows: AsyncIterable<SheetCell[]> | Iterable<SheetCell[]>
  /** In characters, per column. */
  widths?: readonly number[]
}

// Excel's cell limit
const MAX_CELL_TEXT = 32_767
// The characters XML 1.0 cannot hold: controls (tab and line breaks aside), U+FFFE and
// U+FFFF, and halves of a surrogate pair standing alone
const NOT_XML = new RegExp(
  [
    "[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\ufffe\\uffff]",
    "[\\ud800-\\udbff](?![\\udc00-\\udfff])",
    "(?<![\\ud800-\\udbff])[\\udc00-\\udfff]",
  ].join("|"),
  "g"
)

const escapeXml = (text: string): string =>
  text
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const sheetName = (name: string): string =>
  name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sayfa"

// 0 → A, 27 → AB
function columnName(index: number): string {
  let name = ""
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name
  }
  return name
}

function cellXml(value: SheetCell, ref: string, style: string): string {
  if (value === null || value === "") {
    return ""
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `<c r="${ref}"${style}><v>${String(value)}</v></c>` : ""
  }
  const text = escapeXml(escapeFormulaStart(value).slice(0, MAX_CELL_TEXT))
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

const NS = "http://schemas.openxmlformats.org"
const MAIN = `${NS}/spreadsheetml/2006/main`
const RELS = `${NS}/officeDocument/2006/relationships`

async function* sheetXml(spec: SheetSpec): AsyncGenerator<string> {
  const widths = spec.widths ?? []
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${String(index + 1)}" max="${String(index + 1)}" width="${String(width)}" customWidth="1"/>`
    )
    .join("")
  yield `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${MAIN}" xmlns:r="${RELS}">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    "<sheetData>"
  let line = 0
  for await (const row of spec.rows) {
    line += 1
    // The header is bold (style 1)
    const style = line === 1 ? ' s="1"' : ""
    const cells = row.map((value, index) =>
      cellXml(value, `${columnName(index)}${String(line)}`, style)
    )
    yield `<row r="${String(line)}">${cells.join("")}</row>`
  }
  yield "</sheetData></worksheet>"
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${MAIN}">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

function packageParts(sheets: readonly SheetSpec[]): [string, string][] {
  const numbers = sheets.map((_, index) => String(index + 1))
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="${NS}/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    numbers
      .map(
        (n) =>
          `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `</Types>`
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS}/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${MAIN}" xmlns:r="${RELS}"><sheets>` +
    sheets
      .map(
        (sheet, index) =>
          `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${String(index + 1)}" r:id="rId${String(index + 1)}"/>`
      )
      .join("") +
    `</sheets></workbook>`
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS}/package/2006/relationships">` +
    numbers
      .map(
        (n) =>
          `<Relationship Id="rId${n}" Type="${RELS}/worksheet" Target="worksheets/sheet${n}.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${String(sheets.length + 1)}" Type="${RELS}/styles" Target="styles.xml"/></Relationships>`
  return [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRels],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", workbookRels],
    ["xl/styles.xml", STYLES],
  ]
}

/** The workbook as a stream of zip bytes; the first sheet is the one an import reads. */
export function writeXlsx(sheets: readonly SheetSpec[]): Readable {
  const zip = new yazl.ZipFile()
  for (const [name, content] of packageParts(sheets)) {
    zip.addBuffer(Buffer.from(content, "utf8"), name)
  }
  const output = zip.outputStream as Readable
  sheets.forEach((sheet, index) => {
    const source = Readable.from(sheetXml(sheet))
    // yazl pipes the source, and a pipe does not pass its errors on
    source.once("error", (error) => {
      output.destroy(error)
    })
    zip.addReadStream(source, `xl/worksheets/sheet${String(index + 1)}.xml`)
  })
  zip.end()
  return output
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
