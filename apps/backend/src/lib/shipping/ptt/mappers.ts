import type { XmlFields } from "../../clients/xml"
import { ValidationError } from "../../errors"
import type { Parcel } from "../parcel"
import type { Receiver } from "../receiver"

/**
 * A parcel as PTT takes it (`InputDongu2` of `kabulEkle2`;
 * docs/entegrasyonlar/ptt.md): its barcode from the shop's range, our
 * code as `musteriReferansNo`, the receiver, its weight in grams and its
 * desi when measured (else the branch measures, adr/0054), what the
 * courier collects at the door ("ödeme şartlı": the `OS` service and its
 * amount in lira). Fields in the service description's order (Axis2 reads
 * a sequence), only those we fill. No e-mail and no second phone: PTT
 * does not need them (KVKK, data minimisation).
 */

export interface PttShipmentInput {
  /** The 13-digit barcode from the shop's range: what PTT tracks and the label carries. */
  barcode: string
  /** Our code for the parcel (`musteriReferansNo`). */
  reference: string
  receiver: Receiver
  /** One parcel's measures; null when not measured (the branch measures). */
  parcel: Pick<Parcel, "weight_kg" | "length_cm" | "width_cm" | "height_cm"> | null
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
}

// `odemesekli`: MH (mahsup) the shop's contract pays the carriage; to confirm with a real account
const CONTRACT_PAYS = "MH"
// "Ödeme şartlı gönderi": PTT collects the amount from the receiver
const PAY_ON_DELIVERY = "OS"

const cut = (value: string, length: number): string => Array.from(value).slice(0, length).join("")

/** One parcel's desi as PTT counts it: its volume / 3000, to two decimals up. */
export function pttDesi(parcel: Pick<Parcel, "length_cm" | "width_cm" | "height_cm">): number {
  const desi = (parcel.length_cm * parcel.width_cm * parcel.height_cm) / 3000
  return Math.max(0, Math.ceil(desi * 100 - 1e-9) / 100)
}

/** Ten digits, no leading 0, as PTT takes a mobile number (`aliciSms`). */
const smsNumber = (phone: string): string => phone.replace(/\D/g, "").replace(/^0/, "")

/**
 * PTT's own minimums (5 characters for the name and the address): told to
 * the shop at the field to fix, before anything is sent.
 */
function checkReceiver(receiver: Receiver): void {
  if (Array.from(receiver.name.trim()).length < 5) {
    throw new ValidationError("ptt.receiver_name_short", { field: "shipping_address.first_name" })
  }
  if (Array.from(receiver.address.trim()).length < 5) {
    throw new ValidationError("shipping.receiver_address_missing", {
      field: "shipping_address.address_1",
    })
  }
}

/** The `dongu` element of `kabulEkle2`, its names unqualified (the client qualifies them). */
export function pttShipmentFields(input: PttShipmentInput): XmlFields {
  checkReceiver(input.receiver)
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  const parcel = input.parcel
  const centimetres = (value: number) => Math.max(1, Math.ceil(value))
  return {
    aAdres: cut(input.receiver.address, 255),
    agirlik: parcel ? Math.max(1, Math.round(parcel.weight_kg * 1000)) : undefined,
    aliciAdi: cut(input.receiver.name, 100),
    aliciIlAdi: cut(input.receiver.city, 100),
    aliciIlceAdi: cut(input.receiver.town, 100),
    aliciSms: smsNumber(input.receiver.phone),
    barkodNo: input.barcode,
    boy: parcel ? centimetres(parcel.length_cm) : undefined,
    deger_ucreti: 0,
    desi: parcel ? pttDesi(parcel) : undefined,
    ekhizmet: cod ? PAY_ON_DELIVERY : undefined,
    en: parcel ? centimetres(parcel.width_cm) : undefined,
    musteriReferansNo: input.reference,
    // Lira with two decimals and a dot (a double); kuruş are whole
    odeme_sart_ucreti: cod ? ((input.cashOnDelivery ?? 0) / 100).toFixed(2) : 0,
    odemesekli: CONTRACT_PAYS,
    ucret: 0,
    yukseklik: parcel ? centimetres(parcel.height_cm) : undefined,
  }
}
