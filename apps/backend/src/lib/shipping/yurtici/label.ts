import { rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"
import { MM, newPdf, printable, wrapText } from "../../pdf"
import { code128Bars } from "../code128"
import type { LabelSize } from "../label-sheet"
import type { Receiver } from "../receiver"

/**
 * The parcel's label for Yurtiçi (adr/0035): Yurtiçi gives none, its
 * branch scans the cargo key on the box. A PDF page of the shop's label
 * size (Settings > Shipping; 100×150 mm unless set): the key as a Code 128
 * barcode, the receiver, the order and what the courier collects. On a
 * smaller label the text shrinks with it, the barcode only as much as the
 * width needs. Turkish text: the label is for a Turkish carrier's branch.
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

const MARGIN = 5 * MM
// Three dots of a 203 dpi printer per module at most, 18 mm tall on a full label
const MODULE = 0.375 * MM
const BAR_HEIGHT = 18 * MM
const MIN_BAR_HEIGHT = 10 * MM
const BLACK = rgb(0, 0, 0)
const DEFAULT_SIZE: LabelSize = { width_mm: 100, height_mm: 150 }

/** The page and how much its text shrinks: what fits 100 mm wide and 110 mm tall stays full size. */
function layoutOf(size: LabelSize) {
  const width = size.width_mm * MM
  const height = size.height_mm * MM
  const k = Math.min(1, size.width_mm / 100, size.height_mm / 110)
  return { width, height, inner: width - 2 * MARGIN, k }
}

const lira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount / 100)

const measure = (value: number): string =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)

/** Writes top-down on the page: `y` is the distance from the top edge. */
class Pen {
  y = MARGIN

  constructor(
    private readonly page: PDFPage,
    private readonly width: number,
    private readonly height: number
  ) {}

  text(value: string, font: PDFFont, size: number, options: { x?: number; center?: boolean } = {}) {
    const text = printable(font, value)
    const width = font.widthOfTextAtSize(text, size)
    const x = options.center ? (this.width - width) / 2 : (options.x ?? MARGIN)
    this.page.drawText(text, { x, y: this.height - this.y - size, size, font, color: BLACK })
    return width
  }

  line(thickness: number) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.height - this.y },
      end: { x: this.width - MARGIN, y: this.height - this.y },
      thickness,
      color: BLACK,
    })
  }

  gap(points: number) {
    this.y += points
  }
}

export async function yurticiLabelPdf(
  input: YurticiLabelInput,
  size: LabelSize = DEFAULT_SIZE
): Promise<Uint8Array> {
  const { width: WIDTH, height: HEIGHT, inner: INNER, k } = layoutOf(size)
  const pt = (points: number) => points * k
  const { doc, regular, bold } = await newPdf()
  doc.setTitle(`Yurtiçi Kargo ${input.cargoKey}`)
  const page = doc.addPage([WIDTH, HEIGHT])
  const pen = new Pen(page, WIDTH, HEIGHT)

  pen.text("Yurtiçi Kargo", bold, pt(16))
  if (input.test) {
    const size = pt(11)
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
  pen.gap(pt(16) + 2 * MM)
  pen.line(1.7)
  pen.gap(3 * MM * k)

  const { modules, bars } = code128Bars(input.cargoKey)
  // As wide as three printer dots a module allows, narrower only when the label is
  const module = Math.min(MODULE, INNER / modules)
  const barHeight = Math.max(MIN_BAR_HEIGHT, BAR_HEIGHT * k)
  const left = (WIDTH - modules * module) / 2
  for (const bar of bars) {
    page.drawRectangle({
      x: left + bar.x * module,
      y: HEIGHT - pen.y - barHeight,
      width: bar.width * module,
      height: barHeight,
      color: BLACK,
    })
  }
  pen.gap(barHeight + 1.5 * MM)
  pen.text(input.cargoKey, bold, pt(13), { center: true })
  pen.gap(pt(13) + 4 * MM * k)

  pen.text("ALICI", regular, pt(8))
  pen.gap(pt(8) + 1.5 * MM * k)
  for (const line of wrapText(bold, pt(14), input.receiver.name, INNER)) {
    pen.text(line, bold, pt(14))
    pen.gap(pt(14) + 1 * MM * k)
  }
  for (const line of wrapText(regular, pt(11), input.receiver.address, INNER)) {
    pen.text(line, regular, pt(11))
    pen.gap(pt(11) + 1 * MM * k)
  }
  pen.text(`${input.receiver.town} / ${input.receiver.city}`, bold, pt(11))
  pen.gap(pt(11) + 1 * MM * k)
  pen.text(input.receiver.phone, regular, pt(11))
  pen.gap(pt(11) + 3 * MM * k)

  if (input.cashOnDelivery !== null && input.cashOnDelivery > 0) {
    const size = pt(13)
    page.drawRectangle({
      x: MARGIN,
      y: HEIGHT - pen.y - size - 4 * MM * k,
      width: INNER,
      height: size + 4 * MM * k,
      borderColor: BLACK,
      borderWidth: 1.7,
    })
    pen.gap(2 * MM * k)
    pen.text(`KAPIDA TAHSİLAT: ${lira(input.cashOnDelivery)}`, bold, size, { center: true })
  }

  const foot = pt(10)
  pen.y = HEIGHT - MARGIN - foot - 2 * MM * k
  pen.line(0.85)
  pen.gap(2 * MM * k)
  pen.text(`Sipariş ${input.orderNumber}`, regular, foot)
  const meta = `${measure(input.desi)} desi · ${measure(input.kg)} kg · 1/1`
  pen.text(meta, regular, foot, { x: WIDTH - MARGIN - regular.widthOfTextAtSize(meta, foot) })

  return doc.save()
}
