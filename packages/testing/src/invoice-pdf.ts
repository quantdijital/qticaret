import { Canvas, M, W, pdfOf, qrBlock, trAmount, wrap } from "./parasut/pdf-canvas"

/**
 * An A4 e-Arşiv / e-Fatura page as GİB's standard view lays it out: the
 * seller, the heading, a QR-like block, the buyer, the invoice's facts,
 * ETTN, the lines, the totals and the notes. Pure and dependency-free
 * (`parasut/pdf-canvas.ts` draws it). For the local Paraşüt
 * (`parasut/printout.ts`); the real one sends its own PDF.
 */

export interface InvoiceParty {
  name: string
  /** Address and contact lines, as printed under the name. */
  lines: string[]
}

export interface InvoiceLine {
  description: string
  quantity: number
  /** Lira, before VAT and before the discount. */
  unitPrice: number
  /** Lira off the line, before VAT. */
  discount: number
  vatRate: number
}

export interface InvoicePdfInput {
  /** "e-Arşiv Fatura" or "e-Fatura". */
  title: string
  seller: InvoiceParty
  buyer: InvoiceParty
  /** Label and value rows of the facts table (number, date, scenario ...). */
  facts: [string, string][]
  ettn: string
  lines: InvoiceLine[]
  notes: string[]
}

const COLUMNS: [string, number, "right" | undefined][] = [
  ["Sıra", 26, undefined],
  ["Mal Hizmet", 177, undefined],
  ["Miktar", 52, "right"],
  ["Birim Fiyat", 62, "right"],
  ["İskonto", 50, "right"],
  ["KDV %", 34, "right"],
  ["KDV Tutarı", 54, "right"],
  ["Tutar", 60, "right"],
]

function drawLines(canvas: Canvas, lines: InvoiceLine[], start: number): number {
  let top = start
  canvas.box(M, top, W - 2 * M, 16, 0.9)
  let x = M
  for (const [label, width, align] of COLUMNS) {
    canvas.text(
      align ? x + width - 4 : x + 4,
      top + 4.5,
      7.5,
      label,
      align ? { bold: true, align } : { bold: true }
    )
    x += width
  }
  top += 16
  lines.forEach((line, index) => {
    const net = Math.round((line.quantity * line.unitPrice - line.discount) * 100) / 100
    const vat = Math.round(net * line.vatRate) / 100
    const words = wrap(line.description, 8, 177 - 14)
    const text = words.length > 2 ? [words[0] ?? "", `${words[1] ?? ""}…`] : words
    const height = 8 + text.length * 10
    const cells = [
      String(index + 1),
      "",
      `${String(line.quantity)} Adet`,
      `${trAmount(line.unitPrice)} TL`,
      `${trAmount(line.discount)} TL`,
      `%${String(line.vatRate)}`,
      `${trAmount(vat)} TL`,
      `${trAmount(net)} TL`,
    ]
    let left = M
    COLUMNS.forEach(([, width, align], column) => {
      if (column === 1) {
        text.forEach((part, row) => {
          canvas.text(left + 4, top + 4 + row * 10, 8, part)
        })
      } else {
        canvas.text(
          align ? left + width - 4 : left + 4,
          top + 4,
          8,
          cells[column] ?? "",
          align ? { align } : {}
        )
      }
      left += width
    })
    top += height
    canvas.line(M, top, W - M, top, 0.3)
  })
  canvas.box(M, start, W - 2 * M, top - start)
  return top
}

function drawTotals(canvas: Canvas, lines: InvoiceLine[], start: number): number {
  let gross = 0
  let discount = 0
  const vats = new Map<number, number>()
  for (const line of lines) {
    const net = Math.round((line.quantity * line.unitPrice - line.discount) * 100) / 100
    gross += Math.round(line.quantity * line.unitPrice * 100) / 100
    discount += line.discount
    vats.set(line.vatRate, (vats.get(line.vatRate) ?? 0) + Math.round(net * line.vatRate) / 100)
  }
  const vatTotal = [...vats.values()].reduce((sum, value) => sum + value, 0)
  const total = gross - discount + vatTotal
  const rows: [string, number, boolean][] = [
    ["Mal Hizmet Toplam Tutarı", gross, false],
    ["Toplam İskonto", discount, false],
    ...[...vats.entries()].map(([rate, value]): [string, number, boolean] => [
      `Hesaplanan KDV (%${String(rate)})`,
      value,
      false,
    ]),
    ["Vergiler Dahil Toplam Tutar", total, false],
    ["Ödenecek Tutar", total, true],
  ]
  let top = start
  for (const [label, value, bold] of rows) {
    canvas.box(W - M - 230, top, 230, 15, bold ? 0.9 : undefined)
    canvas.text(W - M - 226, top + 4, 8, label, { bold: true })
    canvas.text(W - M - 4, top + 4, 8, `${trAmount(value)} TL`, { bold, align: "right" })
    top += 15
  }
  return top
}

function drawParty(
  canvas: Canvas,
  party: InvoiceParty,
  top: number,
  width: number,
  heading?: string
): number {
  let y = top
  if (heading) {
    canvas.text(M, y, 8, heading, { bold: true })
    y += 11
  }
  for (const part of wrap(party.name, 9.5, width, true)) {
    canvas.text(M, y, 9.5, part, { bold: true })
    y += 12
  }
  for (const part of party.lines.flatMap((line) => wrap(line, 8, width))) {
    canvas.text(M, y, 8, part)
    y += 10
  }
  return y
}

export function invoicePdf(input: InvoicePdfInput): Buffer {
  const canvas = new Canvas()
  const sellerEnd = drawParty(canvas, input.seller, M, 200)
  canvas.text((M + 200 + W - M - 84) / 2, M + 34, 15, input.title, { bold: true, align: "center" })
  qrBlock(canvas, W - M - 84, M, 84, input.ettn)
  let top = Math.max(sellerEnd, M + 92) + 10
  canvas.line(M, top, W - M, top, 1)
  top += 12
  const buyerEnd = drawParty(canvas, input.buyer, top, 250, "SAYIN")
  let factsTop = top
  for (const [label, value] of input.facts) {
    canvas.box(W - M - 230, factsTop, 230, 14)
    canvas.text(W - M - 226, factsTop + 3.5, 7.5, label, { bold: true })
    canvas.text(W - M - 116, factsTop + 3.5, 7.5, value)
    factsTop += 14
  }
  top = Math.max(buyerEnd, factsTop) + 10
  canvas.text(M, top, 8, `ETTN: ${input.ettn}`, { bold: true })
  top += 18
  // A page holds about twenty lines; the rest are named, not dropped silently
  const shown = input.lines.slice(0, 22)
  top = drawLines(canvas, shown, top) + 10
  const totalsEnd = drawTotals(canvas, input.lines, top)
  const notes = [
    ...(input.lines.length > shown.length
      ? [
          `Bu sayfada gösterilmeyen ${String(input.lines.length - shown.length)} kalem toplamlara dahildir.`,
        ]
      : []),
    ...input.notes,
  ]
  top = totalsEnd + 12
  const written = notes.flatMap((note) => wrap(note, 7.5, W - 2 * M - 12))
  canvas.box(M, top, W - 2 * M, 8 + written.length * 10, 0.96)
  written.forEach((part, index) => {
    canvas.text(M + 6, top + 4 + index * 10, 7.5, part)
  })
  return pdfOf(
    canvas.ops.join("\n"),
    input.facts.find(([label]) => label === "Fatura No")?.[1] ?? input.title
  )
}
