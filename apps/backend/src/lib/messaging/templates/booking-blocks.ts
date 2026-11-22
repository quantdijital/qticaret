import { messageText } from "../texts"
import type { EmailBlock } from "./layout"

/**
 * The parts a dated order's e-mails are built of (adr/0076 Ek D7b): a
 * departure, the cancellation terms, and the voucher's link or, on the
 * simple path (Ek basit yol), the shop's own note in its place.
 */

/** A departure as a message shows it. */
export interface BookingDepartureVars {
  title: string
  /** The date and time in the product's zone, written out. */
  when: string
  meetingPoint: string | null
  units: number
}

/** A cancellation tier as sold: from `days` days before, `percent` kept. */
export interface BookingTermVars {
  days: number
  percent: number
}

/** What a confirmation or reminder says of the voucher and the shopper's cancel. */
export interface BookingFlowVars {
  /** The voucher's page; null: none (the shop runs without vouchers, or no link). */
  voucherUrl: string | null
  /** Set while the shop runs without vouchers: its own words, or "" for the default sentence. */
  voucherOffNote: string | null
  /** Whether the shopper may cancel from the order's page (off: by phone or e-mail). */
  onlineCancel: boolean
  orderUrl: string | null
}

export function departureLines(departure: BookingDepartureVars): string[] {
  return [
    messageText("booking.when", { when: departure.when }),
    ...(departure.meetingPoint
      ? [messageText("booking.meeting_point", { place: departure.meetingPoint })]
      : []),
    messageText("booking.units", { count: departure.units }),
  ]
}

export const departureBlocks = (departures: BookingDepartureVars[]): EmailBlock[] =>
  departures.map((departure) => ({
    kind: "details" as const,
    title: messageText("booking.departure", { title: departure.title }),
    lines: departureLines(departure),
  }))

export function termText(term: BookingTermVars): string {
  const values = { days: term.days, percent: term.percent }
  if (term.days === 0) {
    return messageText(
      term.percent === 0 ? "booking.term_free_today" : "booking.term_fee_today",
      values
    )
  }
  return messageText(term.percent === 0 ? "booking.term_free" : "booking.term_fee", values)
}

export function termBlocks(terms: BookingTermVars[], onlineCancel: boolean): EmailBlock[] {
  return [
    {
      kind: "details",
      title: messageText("booking.terms_title"),
      lines:
        terms.length === 0
          ? [messageText("booking.terms_none")]
          : [
              ...terms.map(termText),
              messageText(onlineCancel ? "booking.terms_how" : "booking.terms_contact"),
            ],
    },
  ]
}

/** The voucher's button and its caution; without vouchers, the shop's note and the order's page. */
export function voucherBlocks(vars: BookingFlowVars): EmailBlock[] {
  if (vars.voucherOffNote !== null) {
    return [
      { kind: "paragraph", text: vars.voucherOffNote || messageText("booking.voucher_off_note") },
      { kind: "button", label: messageText("booking.view_order"), url: vars.orderUrl },
    ]
  }
  return [
    { kind: "button", label: messageText("booking_confirmed.voucher"), url: vars.voucherUrl },
    ...(vars.voucherUrl
      ? [{ kind: "note" as const, text: messageText("booking_confirmed.voucher_note") }]
      : []),
  ]
}
