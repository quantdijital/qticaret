import type { XmlFields } from "../../clients/xml"
import { kurus, toMedusaAmount } from "../../money"
import { AddressIncomplete } from "../geliver/mappers"
import type { AddressRow } from "../geliver/mappers"
import type { ArasCredentials } from "./credentials"

/**
 * An order as Aras takes it (adr/0035): a Turkish address split the way
 * Medusa keeps it (adr/0008: il in `province`, ilçe in `city`, mahalle in
 * `address_2`), the parcel's desi and weight, and what the courier collects
 * at the door. The shop pays the shipping (its contract); one parcel, one
 * piece. Amounts with a dot, as the service reads them.
 */

export interface ArasReceiver {
  name: string
  address: string
  /** Mahalle, when the address names it. */
  quarter: string | null
  town: string
  city: string
  phone: string
}

export interface ArasOrderInput {
  /** Our code for the parcel: Aras finds it, tracks it and labels it by this. */
  integrationCode: string
  /** The order's number, as the waybill names it. */
  waybill: string
  receiver: ArasReceiver
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  description: string
}

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/** A Turkish phone as a courier dials it: 0 and ten digits. */
export function localPhone(value: string | null | undefined): string {
  const digits = filled(value).replace(/\D/g, "")
  const national = digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits
  const ten = national.startsWith("0") ? national.slice(1) : national
  return ten.length === 10 ? `0${ten}` : ""
}

/** The parcel's receiver from the order's delivery address, or the first part missing. */
export function arasReceiverOf(address: AddressRow | null | undefined): ArasReceiver {
  if (filled(address?.country_code).toLowerCase() !== "tr") {
    throw new AddressIncomplete("country_code")
  }
  const name = [filled(address?.first_name), filled(address?.last_name)].filter(Boolean).join(" ")
  const parts = {
    first_name: name,
    address_1: filled(address?.address_1),
    city: filled(address?.city),
    province: filled(address?.province),
    phone: localPhone(address?.phone),
  }
  for (const [field, value] of Object.entries(parts)) {
    if (!value) {
      throw new AddressIncomplete(field)
    }
  }
  const quarter = filled(address?.address_2)
  return {
    name,
    address: [quarter, parts.address_1].filter(Boolean).join(", "),
    quarter: quarter === "" ? null : quarter,
    town: parts.city,
    city: parts.province,
    phone: parts.phone,
  }
}

const decimal = (value: number): string => value.toFixed(2)

/** The `Order` element of `SetOrder`, as the service describes it. */
export function arasOrderFields(credentials: ArasCredentials, input: ArasOrderInput): XmlFields {
  const cod = input.cashOnDelivery !== null && input.cashOnDelivery > 0
  return {
    UserName: credentials.username,
    Password: credentials.password,
    TradingWaybillNumber: input.waybill,
    InvoiceNumber: input.waybill,
    ReceiverName: input.receiver.name,
    ReceiverAddress: input.receiver.address,
    ReceiverPhone1: input.receiver.phone,
    ReceiverCityName: input.receiver.city,
    ReceiverTownName: input.receiver.town,
    ReceiverQuarterName: input.receiver.quarter,
    VolumetricWeight: decimal(input.desi),
    Weight: decimal(input.kg),
    PieceCount: "1",
    IntegrationCode: input.integrationCode,
    Description: input.description,
    IsCod: cod ? "1" : "0",
    // Cash at the door (Aras's collection and billing types to confirm with the contract)
    CodAmount: cod ? toMedusaAmount(kurus(input.cashOnDelivery ?? 0)) : "0",
    CodCollectionType: cod ? "0" : null,
    CodBillingType: cod ? "0" : null,
    // The shop pays the shipping under its contract
    PayorTypeCode: "1",
    IsWorldWide: "0",
    PieceDetails: {
      PieceDetail: [
        {
          VolumetricWeight: decimal(input.desi),
          Weight: decimal(input.kg),
          BarcodeNumber: input.integrationCode,
          Description: input.description,
        },
      ],
    },
  }
}
