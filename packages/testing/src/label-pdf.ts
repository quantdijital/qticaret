import { MM, pdfDocument, pdfString, textWidth, wrapText } from "./pdf"

/**
 * A parcel label as a carrier prints one on its 100×150 mm thermal
 * labels, drawn by the fake carriers from what the shop sent them: the
 * carrier and its service, where the parcel goes, the tracking number as
 * a Code 128 barcode, sender and receiver, measures, what the courier
 * collects at the door, the date and the shop's references. A TEST box
 * only when the shop asked for a test shipment.
 */

export interface LabelParty {
  name: string
  address: string
  town: string
  city: string
  phone?: string
}

export interface CarrierLabel {
  /** "Aras Kargo", "MNG Kargo". */
  carrier: string
  /** The service and who pays, beside the carrier's name. */
  service: string
  trackingNumber: string
  /** Left off when the carrier knows the sender from the contract only. */
  sender: LabelParty | null
  receiver: LabelParty
  piece: number
  pieces: number
  /** As the label prints them ("2,00"); left off when not sent. */
  desi: string | null
  kg: string | null
  /** What the courier collects ("1.234,56 TL"); null when paid already. */
  cashOnDelivery: string | null
  /** The shop's references in the footer: the order's number, the code it sent. */
  references: string[]
  date: Date
  test: boolean
}

const WIDTH = 100 * MM
const HEIGHT = 150 * MM
const MARGIN = 5 * MM
const INNER = WIDTH - 2 * MARGIN

/** A number as Turkish labels print it: "2,00". */
export const trNumber = (value: number): string =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  )

/** Lira as Turkish labels print them: "1.234,56 TL". */
export const trLira = (value: number): string => `${trNumber(value)} TL`

const trDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "")

// Code 128 bar and space widths by symbol value (ISO/IEC 15417); 106 is the stop
// prettier-ignore
const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
]

/** Code set B's bars by module, ten modules of quiet zone each side. */
export function code128Bars(text: string): { modules: number; bars: [number, number][] } {
  if (!/^[\x20-\x7e]{1,48}$/.test(text)) {
    throw new RangeError("code128: 1 to 48 printable ASCII characters")
  }
  const values = Array.from(text, (char) => char.charCodeAt(0) - 32)
  const check = values.reduce((sum, value, index) => sum + value * (index + 1), 104) % 103
  let x = 10
  const bars: [number, number][] = []
  for (const value of [104, ...values, check, 106]) {
    Array.from(CODE128[value] ?? "", Number).forEach((width, index) => {
      if (index % 2 === 0) {
        bars.push([x, width])
      }
      x += width
    })
  }
  return { modules: x + 10, bars }
}

/** Draws top-down: `y` is the distance from the top edge, in points. */
class Pen {
  y = MARGIN
  readonly ops: string[] = []

  text(
    value: string,
    size: number,
    options: { bold?: boolean; x?: number; align?: "center" | "right"; white?: boolean } = {}
  ) {
    const width = textWidth(value, size, options.bold)
    const x =
      options.align === "center"
        ? (WIDTH - width) / 2
        : options.align === "right"
          ? WIDTH - MARGIN - (options.x ?? 0) - width
          : (options.x ?? MARGIN)
    const base = HEIGHT - this.y - size * 0.82
    const font = options.bold ? "F2" : "F1"
    const color = options.white ? "1 g " : ""
    this.ops.push(
      `q ${color}BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${base.toFixed(2)} Td ${pdfString(value)} Tj ET Q`
    )
  }

  fill(x: number, top: number, width: number, height: number) {
    this.ops.push(
      `${x.toFixed(2)} ${(HEIGHT - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
    )
  }

  box(x: number, top: number, width: number, height: number, line: number) {
    this.ops.push(
      `q ${line.toFixed(2)} w ${x.toFixed(2)} ${(HEIGHT - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`
    )
  }

  rule(line = 0.8) {
    this.ops.push(
      `q ${line.toFixed(2)} w ${MARGIN.toFixed(2)} ${(HEIGHT - this.y).toFixed(2)} m ${(WIDTH - MARGIN).toFixed(2)} ${(HEIGHT - this.y).toFixed(2)} l S Q`
    )
  }

  /** Wrapped lines of text, at most `max`; the last one cut short when more remain. */
  lines(value: string, size: number, max: number, bold = false, gap = 1.15) {
    const lines = wrapText(value, size, INNER, bold)
    for (const line of lines.slice(0, max)) {
      this.text(line, size, { bold })
      this.y += size * gap
    }
  }
}

/** The largest size up to `size` at which a text fits `width`. */
const fitting = (value: string, size: number, width: number, bold: boolean) =>
  Math.max(7, Math.min(size, (size * width) / Math.max(1, textWidth(value, size, bold))))

const place = (party: LabelParty) =>
  `${party.town.toLocaleUpperCase("tr")} / ${party.city.toLocaleUpperCase("tr")}`

function party(pen: Pen, heading: string, who: LabelParty, large: boolean) {
  const size = large ? 9.5 : 7.5
  pen.text(heading, 6.5)
  pen.y += 8.5
  pen.lines(who.name, large ? 12 : 8.5, large ? 2 : 1, true)
  pen.lines(who.address, size, large ? 3 : 2)
  pen.text(place(who), size, { bold: true })
  if (who.phone && !large) {
    pen.text(`Tel: ${who.phone}`, size, { align: "right" })
  }
  pen.y += size * 1.2
  if (who.phone && large) {
    pen.text(`Tel: ${who.phone}`, size)
    pen.y += size * 1.2
  }
  pen.y += 3
  pen.rule()
  pen.y += 5
}

/** The label as a one-page PDF. */
export function carrierLabelPdf(label: CarrierLabel): Buffer {
  const pen = new Pen()

  // The carrier's band
  pen.fill(MARGIN, pen.y, INNER, 30)
  pen.y += 7
  pen.text(label.carrier.toLocaleUpperCase("tr"), fitting(label.carrier, 15, INNER * 0.55, true), {
    bold: true,
    x: MARGIN + 6,
    white: true,
  })
  pen.text(label.service, 7.5, { align: "right", x: 6, white: true })
  pen.y += 10
  pen.text(trDate(label.date), 7.5, { align: "right", x: 6, white: true })
  pen.y += 19

  // Where it goes, and which piece it is
  const pieceBox = 48
  pen.text("VARIŞ", 6.5)
  pen.box(WIDTH - MARGIN - pieceBox, pen.y, pieceBox, 30, 1)
  pen.text("PARÇA", 6.5, { align: "right", x: (pieceBox - textWidth("PARÇA", 6.5)) / 2 })
  if (label.test) {
    const testX = WIDTH - MARGIN - pieceBox - 46
    pen.box(testX, pen.y + 5, 40, 20, 1.6)
    const size = 11
    pen.ops.push(
      `BT /F2 ${String(size)} Tf ${(testX + (40 - textWidth("TEST", size, true)) / 2).toFixed(2)} ${(HEIGHT - pen.y - 19).toFixed(2)} Td ${pdfString("TEST")} Tj ET`
    )
  }
  const destination = place(label.receiver)
  const room = INNER - pieceBox - (label.test ? 52 : 6)
  pen.y += 9
  pen.text(destination, fitting(destination, 15, room, true), { bold: true })
  const count = `${String(label.piece)}/${String(label.pieces)}`
  pen.text(count, 13, {
    bold: true,
    align: "right",
    x: (pieceBox - textWidth(count, 13, true)) / 2,
  })
  pen.y += 25
  pen.rule()
  pen.y += 6

  // The tracking number, scanned and read
  const { modules, bars } = code128Bars(label.trackingNumber)
  const module = Math.min(1.2, INNER / modules)
  const left = (WIDTH - modules * module) / 2
  for (const [x, width] of bars) {
    pen.fill(left + x * module, pen.y, width * module, 50)
  }
  pen.y += 54
  pen.text(label.trackingNumber, 12, { bold: true, align: "center" })
  pen.y += 16
  pen.rule()
  pen.y += 5

  if (label.sender) {
    party(pen, "GÖNDERİCİ", label.sender, false)
  }
  party(pen, "ALICI", label.receiver, true)

  // Date and measures, a cell each
  const cells = [
    ["TARİH", trDate(label.date).slice(0, 10)],
    ...(label.desi ? [["DESİ", label.desi]] : []),
    ...(label.kg ? [["KG", label.kg]] : []),
  ]
  const cell = INNER / cells.length
  cells.forEach(([name = "", value = ""], index) => {
    const x = MARGIN + index * cell
    pen.box(x, pen.y, cell, 26, 0.8)
    pen.text(name, 6, { x: x + 4 })
    pen.y += 9
    pen.text(value, 10, { bold: true, x: x + 4 })
    pen.y -= 9
  })
  pen.y += 32

  if (label.cashOnDelivery) {
    pen.box(MARGIN, pen.y, INNER, 26, 1.8)
    pen.y += 7
    pen.text(`KAPIDA TAHSİLAT: ${label.cashOnDelivery}`, 12, { bold: true, align: "center" })
    pen.y += 25
  }

  // The shop's references at the foot
  pen.y = Math.max(pen.y, HEIGHT - MARGIN - 18)
  pen.rule(0.6)
  pen.y += 5
  const [first = "", second = ""] = label.references
  pen.text(first, 7.5)
  pen.text(second, 7.5, { align: "right" })

  return pdfDocument([{ width: WIDTH, height: HEIGHT, content: pen.ops.join("\n") }], {
    title: `${label.carrier} ${label.trackingNumber}`,
    created: label.date,
  })
}
