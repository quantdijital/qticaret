import { MM, newPdf, wrapText } from "../../pdf"
import { code128Bars } from "../code128"
import type { LabelSize } from "../label-sheet"
import type { Receiver } from "../receiver"
import { BLACK, MARGIN, Pen } from "./pen"

/**
 * The parcel label we draw for a contract carrier that gives none we can
 * print (adr/0035): Yurtiçi gives no label at all, DHL eCommerce gives a
 * Zebra (ZPL) one a browser cannot show. A PDF page of the shop's label
 * size (Settings > Shipping; 100×150 mm unless set): the carrier's code as
 * a Code 128 barcode, its shipment number, the sender when the carrier
 * wants it printed, the receiver, the order, the parcel's measures and
 * what the courier collects. On a smaller label the text shrinks with it,
 * the barcode only as much as the width needs. Drawn here, on our server:
 * no label data goes to a converter (KVKK). Turkish text: the label is for
 * a Turkish carrier's branch.
 */

/** Who sends the parcel, as printed: the shop's legal name, address and phone. */
export interface LabelSender {
  name: string
  address: string | null
  phone: string | null
}

export interface CarrierLabelInput {
  /** The carrier as its branch knows it, the label's title ("DHL eCommerce"). */
  carrier: string
  /** What the branch scans: drawn as the barcode and printed under it. */
  code: string
  /** The carrier's own number for the parcel, when it differs from the code. */
  shipmentNumber?: string | null
  /** The shop; null when the carrier knows it from the contract (Yurtiçi). */
  sender?: LabelSender | null
  orderNumber: string
  receiver: Receiver
  /** Null when not sent to the carrier (a product without measures, adr/0054). */
  desi: number | null
  kg: number | null
  /** This parcel and how many go together; 1/1 unless given. */
  piece?: { index: number; count: number }
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  test: boolean
}

// Three dots of a 203 dpi printer per module at most, 18 mm tall on a full label
const MODULE = 0.375 * MM
const BAR_HEIGHT = 18 * MM
const MIN_BAR_HEIGHT = 10 * MM
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

export async function carrierLabelPdf(
  input: CarrierLabelInput,
  size: LabelSize = DEFAULT_SIZE
): Promise<Uint8Array> {
  const { width: WIDTH, height: HEIGHT, inner: INNER, k } = layoutOf(size)
  const pt = (points: number) => points * k
  const { doc, regular, bold } = await newPdf()
  doc.setTitle(`${input.carrier} ${input.code}`)
  const page = doc.addPage([WIDTH, HEIGHT])
  const pen = new Pen(page, WIDTH, HEIGHT)
  const lines = (text: string, font: typeof regular, points: number, max = Infinity) => {
    for (const line of wrapText(font, pt(points), text, INNER).slice(0, max)) {
      pen.text(line, font, pt(points))
      pen.gap(pt(points) + 1 * MM * k)
    }
  }

  pen.text(input.carrier, bold, pt(16))
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

  const { modules, bars } = code128Bars(input.code)
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
  pen.text(input.code, bold, pt(13), { center: true })
  pen.gap(pt(13) + 2 * MM * k)
  if (input.shipmentNumber) {
    pen.text(`Gönderi no: ${input.shipmentNumber}`, regular, pt(10), { center: true })
    pen.gap(pt(10) + 2 * MM * k)
  }
  pen.gap(2 * MM * k)

  if (input.sender) {
    pen.text("GÖNDERİCİ", regular, pt(8))
    pen.gap(pt(8) + 1.5 * MM * k)
    lines(input.sender.name, bold, 10, 2)
    if (input.sender.address) {
      lines(input.sender.address, regular, 9, 2)
    }
    if (input.sender.phone) {
      lines(input.sender.phone, regular, 9, 1)
    }
    pen.gap(2 * MM * k)
  }

  pen.text("ALICI", regular, pt(8))
  pen.gap(pt(8) + 1.5 * MM * k)
  lines(input.receiver.name, bold, 14)
  lines(input.receiver.address, regular, 11)
  // Il and ilçe are optional at some carriers: a label never prints a lone slash
  const place = [input.receiver.town, input.receiver.city].filter(Boolean).join(" / ")
  if (place) {
    lines(place, bold, 11, 1)
  }
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
  const piece = input.piece ?? { index: 1, count: 1 }
  // Unmeasured, the branch weighs it: only what was sent is printed
  const meta = [
    input.desi === null ? null : `${measure(input.desi)} desi`,
    input.kg === null ? null : `${measure(input.kg)} kg`,
    `${String(piece.index)}/${String(piece.count)}`,
  ]
    .filter(Boolean)
    .join(" · ")
  pen.text(meta, regular, foot, { x: WIDTH - MARGIN - regular.widthOfTextAtSize(meta, foot) })

  return doc.save()
}
