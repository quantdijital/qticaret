import type { XmlFields } from "../../clients/xml"
import { kurus, toMedusaAmount } from "../../money"
import type { Receiver } from "../receiver"

/**
 * A parcel as Yurtiçi takes it (`ShippingOrderVO`, adr/0035): our code as
 * its cargo key, the receiver (`../receiver`), its desi and weight, and
 * what the courier collects at the door. Who pays the shipping is not a
 * field: the account the parcel goes out on says it. Lengths as the
 * service's description gives them; amounts with a dot.
 */

export interface YurticiShipmentInput {
  /** Our code for the parcel: printed as its barcode, found and tracked by it. */
  cargoKey: string
  /** The order's number: digits, the door collection's document. */
  orderNumber: string
  receiver: Receiver
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
}

const cut = (value: string, length: number): string => value.slice(0, length)

const decimal = (value: number): string => value.toFixed(3)

/** The `ShippingOrderVO` element of `createShipment`, as the service describes it. */
export function yurticiShipmentFields(input: YurticiShipmentInput): XmlFields {
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  const document = /^\d{1,12}$/.test(input.orderNumber) ? input.orderNumber : "0"
  return {
    cargoKey: input.cargoKey,
    // One key per parcel for both: ours is unique already
    invoiceKey: input.cargoKey,
    receiverCustName: cut(input.receiver.name, 200),
    receiverAddress: cut(input.receiver.address, 500),
    cityName: cut(input.receiver.city, 40),
    townName: cut(input.receiver.town, 40),
    receiverPhone1: input.receiver.phone,
    // Numbers the service's description requires; zero when the parcel has none
    taxOfficeId: 0,
    desi: decimal(input.desi),
    kg: decimal(input.kg),
    cargoCount: 1,
    ttInvoiceAmount: cod ? toMedusaAmount(kurus(input.cashOnDelivery ?? 0)) : null,
    ttDocumentId: cod ? document : 0,
    // Cash at the door, on the parcel's own collection document
    ttCollectionType: cod ? "0" : null,
    ttDocumentSaveType: cod ? "0" : null,
    dcSelectedCredit: 0,
    dcCreditRule: 0,
    description: cut(`Sipariş ${input.orderNumber}`, 255),
  }
}
