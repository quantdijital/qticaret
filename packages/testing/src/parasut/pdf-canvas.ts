import { createHash } from "node:crypto"

/**
 * The few PDF strokes the local Paraşüt's invoice needs (`invoice-pdf.ts`),
 * without a dependency: text in the PDF's own Helvetica and
 * Helvetica-Bold, widths from Helvetica's metrics; lines, boxes, and a
 * page written out with a counted cross-reference table.
 *
 * Ş, Ğ and İ are not in the glyph set every viewer substitutes for
 * Helvetica (Chrome's has neither): they print as S, G and I with the
 * cedilla, breve or dot drawn on, at Helvetica's own composite offsets,
 * and a ToUnicode map gives copy and search the Turkish letter back.
 */

export const W = 595.28
export const H = 841.89
export const M = 40

// Helvetica and Helvetica-Bold advance widths for ASCII 32-126 (Adobe's AFM)
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]
// Turkish letters WinAnsi lacks, on codes 1-6: their base glyphs by the fonts' /Differences
const EXTRA = "ŞşĞğİı"
const DIFFERENCES = "[1 /S /s /G /g /I /dotlessi]"
const LOOKS_LIKE: Record<string, string> = { Ğ: "G", ğ: "g", İ: "I", ı: "i", Ş: "S", ş: "s" }
const WIN_ANSI: Record<string, number> = {
  "–": 150,
  "—": 151,
  "•": 149,
  "’": 146,
  "€": 128,
  "…": 133,
}

function encode(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 63
      const extra = EXTRA.indexOf(char)
      if (extra >= 0) {
        return `\\00${String(extra + 1)}`
      }
      if (char === "(" || char === ")" || char === "\\") {
        return `\\${char}`
      }
      if (code >= 32 && code < 127) {
        return char
      }
      const ansi = WIN_ANSI[char] ?? (code >= 160 && code <= 255 ? code : 63)
      return `\\${ansi.toString(8).padStart(3, "0")}`
    })
    .join("")
}

function widthOf(text: string, size: number, bold: boolean): number {
  const table = bold ? BOLD : REGULAR
  const units = Array.from(text.normalize("NFC")).reduce((sum, char) => {
    const base = (LOOKS_LIKE[char] ?? char.normalize("NFD")[0] ?? "?").charCodeAt(0)
    return sum + (char === "ı" ? 278 : (table[base - 32] ?? 556))
  }, 0)
  return (units * size) / 1000
}

/** Words of `text` in lines no wider than `width`. */
export function wrap(text: string, size: number, width: number, bold = false): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && widthOf(next, size, bold) > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  return line ? [...lines, line] : lines
}

const num = (value: number) => String(Math.round(value * 100) / 100)

const K = 0.5523

/** The mark a base glyph lacks, in glyph units around its centre `cx`. */
function mark(char: string, cx: number, bold: boolean): string {
  const stroke = bold ? 82 : 60
  if (char === "İ") {
    const r = bold ? 62 : 54
    const cy = 845
    const arc = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
      `${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x)} ${num(y)} c`
    return [
      `${num(cx + r)} ${String(cy)} m`,
      arc(cx + r, cy + K * r, cx + K * r, cy + r, cx, cy + r),
      arc(cx - K * r, cy + r, cx - r, cy + K * r, cx - r, cy),
      arc(cx - r, cy - K * r, cx - K * r, cy - r, cx, cy - r),
      arc(cx + K * r, cy - r, cx + r, cy - K * r, cx + r, cy),
      "f",
    ].join(" ")
  }
  if (char === "Ğ" || char === "ğ") {
    const top = char === "Ğ" ? 915 : 735
    return `${String(stroke)} w 1 J ${num(cx - 110)} ${String(top)} m ${num(cx - 110)} ${String(top - 135)} ${num(cx + 110)} ${String(top - 135)} ${num(cx + 110)} ${String(top)} c S`
  }
  return `${String(stroke)} w 0 J ${num(cx + 10)} 0 m ${num(cx + 10)} -70 l ${num(cx + 105)} -70 ${num(cx + 105)} -205 ${num(cx - 75)} -205 c S`
}

/** "1.234,50" */
export const trAmount = (lira: number): string =>
  lira.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Draws top-down: `top` is the distance from the page's top edge. */
export class Canvas {
  readonly ops: string[] = []

  text(x: number, top: number, size: number, value: string, options: Opts = {}) {
    const bold = options.bold ?? false
    const width = widthOf(value, size, bold)
    const left =
      options.align === "right" ? x - width : options.align === "center" ? x - width / 2 : x
    const baseline = H - top - size
    this.ops.push(
      `BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${num(left)} ${num(baseline)} Td (${encode(value)}) Tj ET`
    )
    const chars = Array.from(value)
    chars.forEach((char, index) => {
      if (!"ŞşĞğİ".includes(char)) {
        return
      }
      const x = left + widthOf(chars.slice(0, index).join(""), size, bold)
      const cx = (widthOf(char, size, bold) * 500) / size
      const scale = String(size / 1000)
      this.ops.push(
        `q ${scale} 0 0 ${scale} ${num(x)} ${num(baseline)} cm ${mark(char, cx, bold)} Q`
      )
    })
  }

  line(x1: number, top1: number, x2: number, top2: number, width = 0.5) {
    this.ops.push(`${num(width)} w ${num(x1)} ${num(H - top1)} m ${num(x2)} ${num(H - top2)} l S`)
  }

  box(x: number, top: number, width: number, height: number, fill?: number) {
    const shape = `${num(x)} ${num(H - top - height)} ${num(width)} ${num(height)} re`
    this.ops.push(fill === undefined ? `0.5 w ${shape} S` : `${String(fill)} g ${shape} f 0 g`)
  }
}

export interface Opts {
  bold?: boolean
  align?: "right" | "center"
}

/** A QR code's look (finder squares, modules from the ETTN): the real one is GİB's to make. */
export function qrBlock(canvas: Canvas, x: number, top: number, size: number, seed: string) {
  const n = 25
  const cell = size / n
  const bits = createHash("sha512").update(seed).digest()
  const finder = (r: number, c: number) =>
    [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ].some(([fr = 0, fc = 0]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7)
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const index = r * n + c
      const dark = finder(r, c) ? false : ((bits[index % 64] ?? 0) >> (index % 8)) & 1
      if (dark) {
        canvas.box(x + c * cell, top + r * cell, cell, cell, 0)
      }
    }
  }
  for (const [fr, fc] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    canvas.box(x + fc * cell, top + fr * cell, 7 * cell, 7 * cell, 0)
    canvas.box(x + (fc + 1) * cell, top + (fr + 1) * cell, 5 * cell, 5 * cell, 1)
    canvas.box(x + (fc + 2) * cell, top + (fr + 2) * cell, 3 * cell, 3 * cell, 0)
  }
}

/** Codes back to Unicode for copy and search: ASCII and Latin-1 as they are, the rest by name. */
function toUnicode(): string {
  const hex = (value: number, digits: number) =>
    value.toString(16).toUpperCase().padStart(digits, "0")
  const chars = [
    ...Array.from(EXTRA).map((char, index): [number, string] => [index + 1, char]),
    ...Object.entries(WIN_ANSI).map(([char, code]): [number, string] => [code, char]),
  ]
  return [
    "/CIDInit /ProcSet findresource begin 12 dict begin begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def /CMapType 2 def",
    "1 begincodespacerange <00> <FF> endcodespacerange",
    "2 beginbfrange <20> <7E> <0020> <A0> <FF> <00A0> endbfrange",
    `${String(chars.length)} beginbfchar`,
    ...chars.map(([code, char]) => `<${hex(code, 2)}> <${hex(char.codePointAt(0) ?? 63, 4)}>`),
    "endbfchar endcmap CMapName currentdict /CMap defineresource pop end end",
  ].join("\n")
}

export function pdfOf(content: string, title: string): Buffer {
  const encoding = `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences ${DIFFERENCES} >>`
  const cmap = toUnicode()
  const font = (name: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding 7 0 R /ToUnicode 9 0 R >>`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(W)} ${String(H)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${String(Buffer.byteLength(content, "latin1"))} >>\nstream\n${content}\nendstream`,
    font("Helvetica"),
    font("Helvetica-Bold"),
    encoding,
    `<< /Title (${title.replace(/[^\x20-\x7e]|[()\\]/g, "")}) >>`,
    `<< /Length ${String(cmap.length)} >>\nstream\n${cmap}\nendstream`,
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
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}
