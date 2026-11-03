/**
 * PDFs written by hand, without a library, for the fake providers'
 * documents (carriers' labels): pages of drawing operators in Helvetica
 * and Helvetica-Bold, two of the fonts every PDF reader carries, in a
 * Turkish encoding: Windows Latin-1 with ğ Ğ ı İ ş Ş where ISO 8859-9
 * puts them. Offsets are counted, so the cross-reference table is right
 * and pdf-lib reads and merges the file.
 */

/** Points in a millimetre. */
export const MM = 72 / 25.4

export interface PdfPage {
  width: number
  height: number
  /** The page's drawing operators. */
  content: string
}

// ISO 8859-9's six letters in Latin-1's places, by their glyph names
const TURKISH: Readonly<Record<string, readonly [number, string]>> = {
  Ğ: [0xd0, "Gbreve"],
  İ: [0xdd, "Idotaccent"],
  Ş: [0xde, "Scedilla"],
  ğ: [0xf0, "gbreve"],
  ı: [0xfd, "dotlessi"],
  ş: [0xfe, "scedilla"],
}
const TAKEN = new Set(Object.values(TURKISH).map(([code]) => code))
// Typography Windows Latin-1 has above 0x7f
const WINDOWS: Readonly<Record<string, number>> = {
  "€": 0x80,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
}

/** A character's code in the fonts' encoding; "?" for one they cannot show. */
function codeOf(char: string): number {
  const turkish = TURKISH[char]
  if (turkish) {
    return turkish[0]
  }
  const code = char.codePointAt(0) ?? 0x3f
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff && !TAKEN.has(code))) {
    return code
  }
  const windows = WINDOWS[char]
  if (windows !== undefined) {
    return windows
  }
  // A letter with a mark the encoding lacks prints as its letter
  const base = char.normalize("NFD").codePointAt(0) ?? 0x3f
  return base >= 0x20 && base <= 0x7e ? base : 0x3f
}

/** A text as a PDF string in the fonts' encoding: `(…)`, escaped. */
export function pdfString(value: string): string {
  let out = ""
  for (const char of value.normalize("NFC").replace(/[\r\n\t]+/g, " ")) {
    const code = codeOf(char)
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += `\\${String.fromCharCode(code)}`
    } else if (code > 0x7e) {
      out += `\\${code.toString(8)}`
    } else {
      out += String.fromCharCode(code)
    }
  }
  return `(${out})`
}

// Advance widths (thousandths of the size) of Helvetica and Helvetica-Bold, from space to "~"
// prettier-ignore
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
// prettier-ignore
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

/** How wide a text is set in points: a letter with a mark as wide as its letter. */
export function textWidth(value: string, size: number, bold = false): number {
  const widths = bold ? BOLD : REGULAR
  let total = 0
  for (const char of value.normalize("NFC")) {
    const base = char === "ı" ? 0x69 : (char.normalize("NFD").codePointAt(0) ?? 0)
    total += widths[base - 0x20] ?? 556
  }
  return (total * size) / 1000
}

/** A text's lines no wider than `width`: broken between words, a too-long word cut. */
export function wrapText(value: string, size: number, width: number, bold = false): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (textWidth(next, size, bold) <= width) {
      line = next
      continue
    }
    if (line) {
      lines.push(line)
    }
    line = word
    while (textWidth(line, size, bold) > width && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > width) {
        cut -= 1
      }
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) {
    lines.push(line)
  }
  return lines
}

/** A document information string: UTF-16 with its byte order mark, as hex. */
const infoString = (value: string) =>
  `<FEFF${Array.from(value)
    .flatMap((char) => {
      const code = char.codePointAt(0) ?? 0x3f
      return code > 0xffff ? [0xfffd] : [code]
    })
    .map((code) => code.toString(16).padStart(4, "0"))
    .join("")
    .toUpperCase()}>`

const pdfDate = (date: Date) => `(D:${date.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z)`

/** The document: the pages in order, `F1` Helvetica and `F2` Helvetica-Bold on each. */
export function pdfDocument(
  pages: readonly PdfPage[],
  info: { title?: string; created?: Date } = {}
): Buffer {
  const differences = Object.values(TURKISH)
    .map(([code, name]) => `${String(code)} /${name}`)
    .join(" ")
  const font = (name: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding 3 0 R >>`
  const first = 7
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${String(first + index * 2)} 0 R`).join(" ")}] /Count ${String(pages.length)} >>`,
    `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${differences}] >>`,
    font("Helvetica"),
    font("Helvetica-Bold"),
    `<< ${info.title ? `/Title ${infoString(info.title)} ` : ""}/CreationDate ${pdfDate(info.created ?? new Date())} >>`,
    ...pages.flatMap((page, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Contents ${String(first + index * 2 + 1)} 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`,
      `<< /Length ${String(Buffer.byteLength(page.content, "latin1"))} >>\nstream\n${page.content}\nendstream`,
    ]),
  ]
  let body = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"))
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body, "latin1")
  body +=
    `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}

/** A one-page document of a 100×150 mm frame and a line of text: the smallest a print counts. */
export function tinyPdf(note: string): Buffer {
  const content = [
    "q 1.5 w 10 10 263 405 re S Q",
    `BT /F2 14 Tf 20 375 Td ${pdfString(note)} Tj ET`,
  ].join("\n")
  return pdfDocument([{ width: 283, height: 425, content }], { title: note })
}
