import { PDFDocument, degrees, rgb } from "pdf-lib"
import type { PDFEmbeddedPage, PDFPage } from "pdf-lib"

/** A printed page and how labels are laid on it, in PDF points. */
export interface Sheet {
  width: number
  height: number
  columns: number
  rows: number
  /** Blank edge around the cells. */
  margin: number
  /** Dashed lines to cut along, between the cells of a plain sheet. */
  guides: boolean
}

const GUIDE = rgb(0.6, 0.6, 0.6)

/**
 * Lays one page in its cell, as large as fits without growing past its
 * own size, centred; turned a quarter when that fits it larger (a
 * landscape label on a portrait roll).
 */
function place(
  page: PDFPage,
  label: PDFEmbeddedPage,
  cell: { x: number; y: number; width: number; height: number }
) {
  const upright = Math.min(1, cell.width / label.width, cell.height / label.height)
  const turned = Math.min(1, cell.width / label.height, cell.height / label.width)
  if (turned > upright) {
    const width = label.height * turned
    const height = label.width * turned
    const left = cell.x + (cell.width - width) / 2
    const bottom = cell.y + (cell.height - height) / 2
    // Turned a quarter anticlockwise about its corner, it spans leftwards from x
    page.drawPage(label, {
      x: left + width,
      y: bottom,
      width: label.width * turned,
      height: label.height * turned,
      rotate: degrees(90),
    })
    return
  }
  const width = label.width * upright
  const height = label.height * upright
  page.drawPage(label, {
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
    width,
    height,
  })
}

function drawGuides(page: PDFPage, sheet: Sheet) {
  const cellWidth = (sheet.width - 2 * sheet.margin) / sheet.columns
  const cellHeight = (sheet.height - 2 * sheet.margin) / sheet.rows
  const dash = { thickness: 0.5, color: GUIDE, dashArray: [3, 3] }
  for (let column = 1; column < sheet.columns; column++) {
    const x = sheet.margin + column * cellWidth
    page.drawLine({ start: { x, y: 0 }, end: { x, y: sheet.height }, ...dash })
  }
  for (let row = 1; row < sheet.rows; row++) {
    const y = sheet.margin + row * cellHeight
    page.drawLine({ start: { x: 0, y }, end: { x: sheet.width, y }, ...dash })
  }
}

/**
 * Every page of every PDF laid on sheets of the shop's label size, in
 * order (labels, F7.7): one to a roll's page, four to an A4 sheet. Blank
 * pages are left out. A part pdf-lib cannot read, or with nothing drawn,
 * is left out and its index returned, so one broken label does not stop
 * the rest and none prints empty.
 */
export async function imposePdfs(
  parts: readonly Uint8Array[],
  sheet: Sheet
): Promise<{ pdf: Uint8Array; skipped: number[] }> {
  const out = await PDFDocument.create({ updateMetadata: false })
  out.setProducer("Quant Ticaret")
  const cellWidth = (sheet.width - 2 * sheet.margin) / sheet.columns
  const cellHeight = (sheet.height - 2 * sheet.margin) / sheet.rows
  const perSheet = sheet.columns * sheet.rows
  const skipped: number[] = []
  let page: PDFPage | null = null
  let slot = 0
  for (const [index, part] of parts.entries()) {
    let labels: PDFEmbeddedPage[]
    try {
      const source = await PDFDocument.load(part, { updateMetadata: false })
      // A page with nothing drawn on it would waste a label: one with only such pages is not read
      const drawn = source.getPageIndices().filter((page) => source.getPage(page).node.Contents())
      if (drawn.length === 0) {
        skipped.push(index)
        continue
      }
      labels = await out.embedPdf(source, drawn)
      // Embedded now, not on save, so a label that cannot be is this part's failure alone
      for (const label of labels) {
        await label.embed()
      }
    } catch {
      skipped.push(index)
      continue
    }
    for (const label of labels) {
      if (!page || slot === perSheet) {
        page = out.addPage([sheet.width, sheet.height])
        if (sheet.guides) {
          drawGuides(page, sheet)
        }
        slot = 0
      }
      const column = slot % sheet.columns
      const row = Math.floor(slot / sheet.columns)
      place(page, label, {
        x: sheet.margin + column * cellWidth,
        // Rows fill from the top of the sheet
        y: sheet.height - sheet.margin - (row + 1) * cellHeight,
        width: cellWidth,
        height: cellHeight,
      })
      slot += 1
    }
  }
  return { pdf: await out.save(), skipped }
}
