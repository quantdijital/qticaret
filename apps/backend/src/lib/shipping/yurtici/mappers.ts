import type { XmlFields } from "../../clients/xml"
import { kurus, toMedusaAmount } from "../../money"
import type { Parcel } from "../parcel"
import type { Receiver } from "../receiver"

/**
 * A parcel as Yurtiçi takes it (`ShippingOrderVO`, adr/0035): our code as
 * its cargo key, the receiver (`../receiver`), its desi and weight, and
 * what the courier collects at the door. Who pays the shipping is not a
 * field: the account the parcel goes out on says it. Lengths, required
 * fields and formats as Yurtiçi's "Web Servis Giden Kargo Teknik Döküman
 * V3" gives them (docs/entegrasyonlar/yurtici.md); amounts with a dot.
 */

export interface YurticiShipmentInput {
  /** Our code for the parcel: printed as its barcode, found and tracked by it. */
  cargoKey: string
  /** The order's number: digits, the door collection's document. */
  orderNumber: string
  receiver: Receiver
  /**
   * The parcel's volume in desi (`yurticiDesi`) and its weight: Yurtiçi
   * keeps them apart. Both optional there (the branch measures); null when
   * a product had no measures of its own, so no made-up value is sent
   * (adr/0054).
   */
  desi: number | null
  kg: number | null
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
}

const cut = (value: string, length: number): string => value.slice(0, length)

const decimal = (value: number): string => value.toFixed(3)

const count = (value: string, pattern: RegExp): number => value.match(pattern)?.length ?? 0

/**
 * The part of the receiver Yurtiçi refuses, found before asking it: a name
 * of at least 5 characters with 4 letters, an address of at least 10
 * letters or digits. Null when Yurtiçi takes both.
 */
export function yurticiReceiverGap(receiver: Receiver): "first_name" | "address_1" | null {
  const name = receiver.name.trim()
  if (name.length < 5 || count(name, /\p{L}/gu) < 4) {
    return "first_name"
  }
  if (count(receiver.address, /[\p{L}\p{N}]/gu) < 10) {
    return "address_1"
  }
  return null
}

/** The parcel's desi as Yurtiçi records it: its volume / 3000, to one decimal up; the kg goes apart. */
export function yurticiDesi(parcel: Pick<Parcel, "length_cm" | "width_cm" | "height_cm">): number {
  const desi = (parcel.length_cm * parcel.width_cm * parcel.height_cm) / 3000
  return Math.max(0, Math.ceil(desi * 10 - 1e-9) / 10)
}

/** The `ShippingOrderVO` element of `createShipment`, as the document describes it. */
export function yurticiShipmentFields(input: YurticiShipmentInput): XmlFields {
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  const document = /^\d{1,12}$/.test(input.orderNumber) ? input.orderNumber : "0"
  return {
    cargoKey: input.cargoKey,
    // One key per parcel for both: ours is unique already
    invoiceKey: input.cargoKey,
    receiverCustName: cut(input.receiver.name, 200),
    // Without the il and the ilçe: they go in their own fields, optional (H), left out when unknown
    receiverAddress: cut(input.receiver.address, 500),
    cityName: input.receiver.city ? cut(input.receiver.city, 40) : null,
    townName: input.receiver.town ? cut(input.receiver.town, 40) : null,
    // Ten digits with the area code, no leading 0 (the document's 2123652426)
    receiverPhone1: input.receiver.phone.replace(/^0/, ""),
    // Numbers the service's description requires: empty when unused, as the document sends them
    taxOfficeId: "",
    // Optional (H): left out when unmeasured, the branch measures the parcel
    desi: input.desi === null ? null : decimal(input.desi),
    kg: input.kg === null ? null : decimal(input.kg),
    cargoCount: 1,
    // Cash at the door (0); the collection service fee on the same invoice (0)
    ttCollectionType: cod ? "0" : null,
    ttInvoiceAmount: cod ? toMedusaAmount(kurus(input.cashOnDelivery ?? 0)) : null,
    ttDocumentId: cod ? document : "",
    ttDocumentSaveType: cod ? "0" : null,
    // Instalments: only when the courier takes a card (ttCollectionType 1), which we do not ask
    dcSelectedCredit: "",
    dcCreditRule: "",
    description: cut(`Sipariş ${input.orderNumber}`, 255),
  }
}
