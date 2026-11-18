import { parseBirfaturaDate } from "./dates"

/**
 * What BirFatura's `invoiceLinkUpdate` says it issued (adr/0072 §6), as the
 * write-back takes it: GİB's number (three letters or digits, the year,
 * nine digits), when, and no ETTN or document type (BirFatura sends
 * neither). Pure; the series and the record are checked by the write-back.
 */

const GIB_NUMBER = /^[A-Z0-9]{3}20\d{2}\d{9}$/
// No e-invoice predates the platform; one dated ahead is a mistake
const EARLIEST = Date.parse("2020-01-01T00:00:00Z")
const DAY_MS = 86_400_000
const TURKIYE_OFFSET_MS = 3 * 3_600_000

export interface ReportedInvoice {
  number: string
  issued_at: Date
}

export type LinkReading =
  | { issued: ReportedInvoice }
  | { missing: true }
  | {
      problem: "einvoice.number_invalid" | "einvoice.issued_at_invalid" | "einvoice.number_year"
    }

export function readInvoiceLink(
  body: { faturaNo?: string | null | undefined; faturaTarihi?: string | null | undefined },
  now: Date = new Date()
): LinkReading {
  const number = body.faturaNo?.trim().toUpperCase() ?? ""
  if (number === "") {
    return { missing: true }
  }
  if (!GIB_NUMBER.test(number)) {
    return { problem: "einvoice.number_invalid" }
  }
  const dated = body.faturaTarihi?.trim() ? parseBirfaturaDate(body.faturaTarihi) : now
  if (!dated || dated.getTime() < EARLIEST || dated.getTime() > now.getTime() + DAY_MS) {
    return { problem: "einvoice.issued_at_invalid" }
  }
  // GİB numbers by the year: the number names the year it was issued in (Türkiye's)
  const year = new Date(dated.getTime() + TURKIYE_OFFSET_MS).getUTCFullYear()
  if (number.slice(3, 7) !== String(year)) {
    return { problem: "einvoice.number_year" }
  }
  return { issued: { number, issued_at: dated } }
}
