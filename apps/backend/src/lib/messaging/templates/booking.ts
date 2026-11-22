import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { departureBlocks, termBlocks, voucherBlocks } from "./booking-blocks"
import type { BookingDepartureVars, BookingFlowVars, BookingTermVars } from "./booking-blocks"
import { renderEmail } from "./layout"
import type { Brand, EmailContext, MessageTemplate } from "./types"

/**
 * A dated order's e-mails (adr/0076 §8, Ek D7b). They count places, never
 * name a traveler; the voucher's code is on its page, not in the e-mail.
 */

export type { BookingDepartureVars, BookingTermVars } from "./booking-blocks"

/** The confirmation and the reminder. */
export interface BookingVars extends BookingFlowVars {
  number: string
  customerName: string
  departures: BookingDepartureVars[]
  /** The first live departure's time, for the reminder's subject. */
  when: string
  /** The terms of the first departure (one product a booking, nearly always); empty: no cancel. */
  terms: BookingTermVars[]
}

/** One departure cancelled: by the shopper or staff, or the whole departure by the shop. */
export interface BookingCancelVars {
  number: string
  customerName: string
  departure: BookingDepartureVars
  /** What was sent back, in lira; null when nothing is sent automatically. */
  refund: string | null
  /** The money is the shop's to give back by hand (paid another way, credit used). */
  byHand: boolean
  orderUrl: string | null
}

const withVoucher = (prefix: string, field: string) => (vars: BookingVars) =>
  `${prefix}.${field}${vars.voucherOffNote === null ? "" : "_simple"}`

const flowBase = (prefix: string) => ({
  subject: `${prefix}.subject`,
  preheader: withVoucher(prefix, "preheader"),
  heading: `${prefix}.heading`,
  intro: withVoucher(prefix, "intro"),
})

const base = (prefix: string) => ({
  subject: `${prefix}.subject`,
  preheader: `${prefix}.preheader`,
  heading: `${prefix}.heading`,
  intro: `${prefix}.intro`,
})

const TOKENS = { mağaza_adı: "shop", müşteri_adı: "name", sipariş_no: "number" } as const

const bookingValues = (vars: BookingVars, brand: Brand) => ({
  shop: brand.shopName,
  name: vars.customerName,
  number: vars.number,
  when: vars.when,
})

const CONFIRMED: EditSpec<BookingVars> = {
  group: "order",
  // The booking's details and terms the shopper relies on, with the voucher
  required: true,
  tokens: TOKENS,
  fields: flowBase("booking_confirmed"),
  values: bookingValues,
}

const REMINDER: EditSpec<BookingVars> = {
  group: "order",
  required: false,
  tokens: { ...TOKENS, kalkış: "when" },
  fields: flowBase("booking_reminder"),
  values: bookingValues,
}

const cancelValues = (vars: BookingCancelVars, brand: Brand) => ({
  shop: brand.shopName,
  name: vars.customerName,
  number: vars.number,
  when: vars.departure.when,
})

const CANCELLED: EditSpec<BookingCancelVars> = {
  group: "order",
  required: true,
  tokens: { ...TOKENS, kalkış: "when" },
  fields: base("booking_cancelled"),
  values: cancelValues,
}

const DEPARTURE_CANCELLED: EditSpec<BookingCancelVars> = {
  ...CANCELLED,
  fields: base("booking_departure_cancelled"),
}

const footer = (brand: Brand) => messageText("footer.order", { shop: brand.shopName })

const SAMPLE_DEPARTURE: BookingDepartureVars = {
  title: "Kapadokya turu",
  when: "12 Mayıs 2027 Çarşamba 08:30",
  meetingPoint: "Kadıköy iskelesi",
  units: 2,
}

const SAMPLE: BookingVars = {
  number: "1042",
  customerName: "Ayşe",
  departures: [SAMPLE_DEPARTURE],
  when: SAMPLE_DEPARTURE.when,
  terms: [
    { days: 30, percent: 0 },
    { days: 7, percent: 50 },
    { days: 0, percent: 100 },
  ],
  voucherUrl: "https://magaza.example/siparis/order_ornek/voucher?token=ornek",
  voucherOffNote: null,
  onlineCancel: true,
  orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
}

function bookingEmail(spec: EditSpec<BookingVars>, withTerms: boolean) {
  return (vars: BookingVars, brand: Brand, context?: EmailContext) => {
    const text = textsFor(spec, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        ...departureBlocks(vars.departures),
        ...(withTerms ? termBlocks(vars.terms, vars.onlineCancel) : []),
        ...voucherBlocks(vars),
      ],
      footer: footer(brand),
    })
  }
}

function refundLines(vars: BookingCancelVars): string[] {
  if (vars.byHand) {
    return [messageText("booking.refund_by_hand")]
  }
  if (vars.refund === null) {
    return [messageText("booking.refund_none")]
  }
  return [
    messageText("booking.refund", { amount: vars.refund }),
    messageText("booking.refund_card"),
  ]
}

function cancelEmail(spec: EditSpec<BookingCancelVars>) {
  return (vars: BookingCancelVars, brand: Brand, context?: EmailContext) => {
    const text = textsFor(spec, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        ...departureBlocks([vars.departure]),
        ...refundLines(vars).map((line) => ({ kind: "paragraph" as const, text: line })),
        { kind: "button", label: messageText("booking.view_order"), url: vars.orderUrl },
      ],
      footer: footer(brand),
    })
  }
}

const SAMPLE_CANCEL: BookingCancelVars = {
  number: "1042",
  customerName: "Ayşe",
  departure: SAMPLE_DEPARTURE,
  refund: "₺4.500,00",
  byHand: false,
  orderUrl: SAMPLE.orderUrl,
}

/** "Rezervasyonunuz onaylandı": departures, meeting point, places, terms, the voucher's link. */
export const bookingConfirmed: MessageTemplate<BookingVars> = {
  name: "booking.confirmed",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: CONFIRMED,
  email: bookingEmail(CONFIRMED, true),
  sample: SAMPLE,
}

/** "Kalkışınız yaklaşıyor", the product's days before (adr/0076 Ek D7b); the shop may turn it off. */
export const bookingReminder: MessageTemplate<BookingVars> = {
  name: "booking.reminder",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: REMINDER,
  email: bookingEmail(REMINDER, false),
  sample: SAMPLE,
}

/** "Rezervasyonunuz iptal edildi": the shopper's or staff's cancel, with what comes back. */
export const bookingCancelled: MessageTemplate<BookingCancelVars> = {
  name: "booking.cancelled",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: CANCELLED,
  email: cancelEmail(CANCELLED),
  sample: SAMPLE_CANCEL,
}

/** "Kalkış iptal edildi": the shop called the departure off, everything paid comes back. */
export const bookingDepartureCancelled: MessageTemplate<BookingCancelVars> = {
  name: "booking.departure_cancelled",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: DEPARTURE_CANCELLED,
  email: cancelEmail(DEPARTURE_CANCELLED),
  sample: { ...SAMPLE_CANCEL, refund: "₺9.000,00" },
}
