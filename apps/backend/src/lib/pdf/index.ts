import fontkit from "@pdf-lib/fontkit"
import { PDFDocument } from "pdf-lib"
import type { PDFFont } from "pdf-lib"
import { NOTO_SANS_BOLD, NOTO_SANS_REGULAR } from "./fonts/noto-sans"

/**
 * PDFs the platform makes (labels, F8's invoices) with pdf-lib, which the
 * user approved on 2026-10-28. Text is set in Noto Sans, cut down to Latin
 * and Turkish (`fonts/`); a character the font lacks prints as "?", never
 * as a crash or an empty box.
 */

export const MM = 72 / 25.4

export interface PdfKit {
  doc: PDFDocument
  regular: PDFFont
  bold: PDFFont
}

export async function newPdf(): Promise<PdfKit> {
  // Our own metadata only: pdf-lib would name itself and stamp the time on save
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const [regular, bold] = await Promise.all([
    doc.embedFont(Buffer.from(NOTO_SANS_REGULAR, "base64"), { subset: true }),
    doc.embedFont(Buffer.from(NOTO_SANS_BOLD, "base64"), { subset: true }),
  ])
  // A label or an invoice says nothing about who made it or when
  doc.setProducer("Quant Ticaret")
  doc.setCreator("Quant Ticaret")
  return { doc, regular, bold }
}

/** The text the font can print: control characters dropped, the rest it lacks as "?". */
export function printable(font: PDFFont, text: string): string {
  const known = new Set(font.getCharacterSet())
  // eslint-disable-next-line no-control-regex -- control characters are what it removes
  return Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " "))
    .map((char) => (known.has(char.codePointAt(0) ?? 0) ? char : "?"))
    .join("")
}

/** The text in lines no wider than `width` at `size`, broken between words (a long word alone). */
export function wrapText(font: PDFFont, size: number, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of printable(font, text).split(/\s+/).filter(Boolean)) {
    const next = line === "" ? word : `${line} ${word}`
    if (line !== "" && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  return line === "" ? lines : [...lines, line]
}

/**
 * The pages of every PDF, in order, as one document (bulk labels). A part
 * pdf-lib cannot read is left out and its index returned, so one broken
 * label does not stop the rest.
 */
export async function mergePdfs(
  parts: readonly Uint8Array[]
): Promise<{ pdf: Uint8Array; skipped: number[] }> {
  const merged = await PDFDocument.create({ updateMetadata: false })
  merged.setProducer("Quant Ticaret")
  const skipped: number[] = []
  for (const [index, part] of parts.entries()) {
    try {
      const source = await PDFDocument.load(part, { updateMetadata: false })
      const pages = await merged.copyPages(source, source.getPageIndices())
      pages.forEach((page) => merged.addPage(page))
    } catch {
      skipped.push(index)
    }
  }
  return { pdf: await merged.save(), skipped }
}
