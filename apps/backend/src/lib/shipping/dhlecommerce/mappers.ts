import { ANONYMOUS_TCKN } from "../../invoicing/types"
import { kurus, toMedusaAmount } from "../../money"
import type { Receiver } from "../receiver"

/**
 * A parcel as DHL eCommerce's REST API takes it (`createRecipient`,
 * `createOrder`, `createbarcode`; docs/entegrasyonlar/dhlecommerce.md, its
 * shapes from the open source clients that use it, to confirm with a real
 * account): our code as its reference, the receiver with DHL's il and ilçe
 * codes, the parcel as one piece, what the courier collects. Who pays the
 * shipping: the sender (the shop's contract). DHL's own SMS to the receiver
 * stay off: the shop's notifications are ours.
 */

export interface DhlEcomShipmentInput {
  /** Our code for the parcel (`shipmentCode`): DHL's `referenceId` and the order's barcode. */
  referenceId: string
  /** The order's number, written in the parcel's content. */
  orderNumber: string
  receiver: Receiver
  /** The order's e-mail: DHL refuses a recipient without one. */
  email: string
  cityCode: number
  districtCode: number
  /** The parcel's desi and kg, whole numbers of at least one (DHL's pieces take integers). */
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
}

/**
 * The receiver's tax identity: DHL refuses a recipient without one (error
 * 26056). We send the anonymous T.C. kimlik number the e-Arşiv draft writes
 * for a buyer who gave none (`ANONYMOUS_TCKN`, lib/invoicing) to every
 * receiver, as a person ("SAHIS"): a carrier needs no one's real tax id to
 * deliver a parcel, and revealing a customer's sealed one for it would
 * hand it to a third party for nothing (KVKK, data minimisation).
 */
export const DHL_ECOMMERCE_TAX = { taxNumber: ANONYMOUS_TCKN, taxOffice: "SAHIS" } as const

const cut = (value: string, length: number): string => value.slice(0, length)

/** A whole number of at least one, up: DHL's pieces take integers. */
export const wholeUp = (value: number): number =>
  Math.max(1, Math.ceil(Number.isFinite(value) ? value - 1e-9 : 1))

/** The receiver's mobile as DHL takes it: ten digits, no leading 0 or 90. */
export const dhlEcomPhone = (phone: string): string =>
  phone.replace(/\D/g, "").replace(/^(?:90|0)(?=\d{10}$)/, "")

const codOf = (input: DhlEcomShipmentInput) => {
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  return {
    isCOD: cod ? 1 : 0,
    // Lira as a JSON number, a dot for its decimals
    codAmount: cod ? Number(toMedusaAmount(kurus(input.cashOnDelivery ?? 0))) : 0,
  }
}

/** The recipient as `createRecipient` and `createOrder` take it: never a `customerId` beside the name. */
export function dhlEcomRecipient(input: DhlEcomShipmentInput) {
  return {
    refCustomerId: "",
    cityCode: input.cityCode,
    cityName: cut(input.receiver.city, 50),
    districtCode: input.districtCode,
    districtName: cut(input.receiver.town, 50),
    address: cut(input.receiver.address, 500),
    bussinessPhoneNumber: "",
    email: cut(input.email, 100),
    taxOffice: DHL_ECOMMERCE_TAX.taxOffice,
    taxNumber: DHL_ECOMMERCE_TAX.taxNumber,
    fullName: cut(input.receiver.name, 100),
    homePhoneNumber: "",
    mobilePhoneNumber: dhlEcomPhone(input.receiver.phone),
  }
}

/** The one piece the parcel is, under its own barcode. */
const piecesOf = (input: DhlEcomShipmentInput) => [
  {
    barcode: `${input.referenceId}_PARCA1`,
    desi: input.desi,
    kg: input.kg,
    content: cut(`Sipariş ${input.orderNumber}`, 100),
  },
]

/** `createOrder`'s body: the order, its pieces and its recipient. */
export function dhlEcomOrderBody(input: DhlEcomShipmentInput) {
  return {
    order: {
      referenceId: input.referenceId,
      barcode: input.referenceId,
      billOfLandingId: "",
      ...codOf(input),
      // 1: standard service; 3: a parcel (PAKET); 1: sender pays; 1: to the address
      shipmentServiceType: 1,
      packagingType: 3,
      content: cut(`Sipariş ${input.orderNumber}`, 100),
      smsPreference1: 0,
      smsPreference2: 0,
      smsPreference3: 0,
      paymentType: 1,
      deliveryType: 1,
      description: cut(`Sipariş ${input.orderNumber}`, 255),
      marketPlaceShortCode: "",
      marketPlaceSaleCode: "",
    },
    orderPieceList: piecesOf(input),
    recipient: dhlEcomRecipient(input),
  }
}

/** `createbarcode`'s body: the order by its reference, priced on its pieces. */
export function dhlEcomBarcodeBody(input: DhlEcomShipmentInput) {
  return {
    referenceId: input.referenceId,
    billOfLandingId: "",
    ...codOf(input),
    printReferenceBarcodeOnError: 0,
    message: "",
    additionalContent1: "",
    additionalContent2: "",
    additionalContent3: "",
    additionalContent4: "",
    orderPieceList: piecesOf(input),
    packagingType: 3,
  }
}
