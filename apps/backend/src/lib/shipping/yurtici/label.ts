import { rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"
import { MM, newPdf, printable, wrapText } from "../../pdf"
import { code128Bars } from "../code128"
import type { Receiver } from "../receiver"

/**
 * The parcel's label for Yurtiçi (adr/0035): Yurtiçi gives none, its
 * branch scans the cargo key on the box. A 100×150 mm PDF page, as label
 * printers take it: the key as a Code 128 barcode, the receiver, the
 * order and what the courier collects. Turkish text: the label is for a
 * Turkish carrier's branch.
 */

export interface YurticiLabelInput {
  cargoKey: string
  orderNumber: string
  receiver: Receiver
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  test: boolean
}

const WIDTH = 100 * MM
const HEIGHT = 150 * MM
const MARGIN = 5 * MM
const INNER = WIDTH - 2 * MARGIN
// Three dots of a 203 dpi printer per module, 18 mm tall
const MODULE = 0.375 * MM
const BAR_HEIGHT = 18 * MM
const BLACK = rgb(0, 0, 0)

const lira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount / 100)

const measure = (value: number): string =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)

/** Writes top-down on the page: `y` is the distance from the top edge. */
class Pen {
  y = MARGIN

  constructor(private readonly page: PDFPage) {}

  text(value: string, font: PDFFont, size: number, options: { x?: number; center?: boolean } = {}) {
    const text = printable(font, value)
    const width = font.widthOfTextAtSize(text, size)
    const x = options.center ? (WIDTH - width) / 2 : (options.x ?? MARGIN)
    this.page.drawText(text, { x, y: HEIGHT - this.y - size, size, font, color: BLACK })
    return width
  }

  line(thickness: number) {
    this.page.drawLine({
      start: { x: MARGIN, y: HEIGHT - this.y },
      end: { x: WIDTH - MARGIN, y: HEIGHT - this.y },
      thickness,
      color: BLACK,
    })
  }

  gap(points: number) {
    this.y += points
  }
}

export async function yurticiLabelPdf(input: YurticiLabelInput): Promise<Uint8Array> {
  const { doc, regular, bold } = await newPdf()
  doc.setTitle(`Yurtiçi Kargo ${input.cargoKey}`)
  const page = doc.addPage([WIDTH, HEIGHT])
  const pen = new Pen(page)

  pen.text("Yurtiçi Kargo", bold, 16)
  if (input.test) {
    const size = 11
    const width = bold.widthOfTextAtSize("TEST", size)
    const x = WIDTH - MARGIN - width - 4 * MM
    page.drawRectangle({
      x: x - 2 * MM,
      y: HEIGHT - pen.y - size - 1.5 * MM,
      width: width + 4 * MM,
      height: size + 2.5 * MM,
      borderColor: BLACK,
      borderWidth: 1.4,
    })
    pen.text("TEST", bold, size, { x })
  }
  pen.gap(16 + 2 * MM)
  pen.line(1.7)
  pen.gap(3 * MM)

  const { modules, bars } = code128Bars(input.cargoKey)
  const left = (WIDTH - modules * MODULE) / 2
  for (const bar of bars) {
    page.drawRectangle({
      x: left + bar.x * MODULE,
      y: HEIGHT - pen.y - BAR_HEIGHT,
      width: bar.width * MODULE,
      height: BAR_HEIGHT,
      color: BLACK,
    })
  }
  pen.gap(BAR_HEIGHT + 1.5 * MM)
  pen.text(input.cargoKey, bold, 13, { center: true })
  pen.gap(13 + 4 * MM)

  pen.text("ALICI", regular, 8)
  pen.gap(8 + 1.5 * MM)
  for (const line of wrapText(bold, 14, input.receiver.name, INNER)) {
    pen.text(line, bold, 14)
    pen.gap(14 + 1 * MM)
  }
  for (const line of wrapText(regular, 11, input.receiver.address, INNER)) {
    pen.text(line, regular, 11)
    pen.gap(11 + 1 * MM)
  }
  pen.text(`${input.receiver.town} / ${input.receiver.city}`, bold, 11)
  pen.gap(11 + 1 * MM)
  pen.text(input.receiver.phone, regular, 11)
  pen.gap(11 + 3 * MM)

  if (input.cashOnDelivery !== null && input.cashOnDelivery > 0) {
    const size = 13
    page.drawRectangle({
      x: MARGIN,
      y: HEIGHT - pen.y - size - 4 * MM,
      width: INNER,
      height: size + 4 * MM,
      borderColor: BLACK,
      borderWidth: 1.7,
    })
    pen.gap(2 * MM)
    pen.text(`KAPIDA TAHSİLAT: ${lira(input.cashOnDelivery)}`, bold, size, { center: true })
  }

  pen.y = HEIGHT - MARGIN - 10 - 2 * MM
  pen.line(0.85)
  pen.gap(2 * MM)
  pen.text(`Sipariş ${input.orderNumber}`, regular, 10)
  const meta = `${measure(input.desi)} desi · ${measure(input.kg)} kg · 1/1`
  pen.text(meta, regular, 10, { x: WIDTH - MARGIN - regular.widthOfTextAtSize(meta, 10) })

  return doc.save()
}
