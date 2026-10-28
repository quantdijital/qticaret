import type { XmlFields } from "../../clients/xml"
import { kurus, toMedusaAmount } from "../../money"
import type { Receiver } from "../receiver"
import type { ArasCredentials } from "./credentials"

/**
 * An order as Aras takes it (adr/0035): the receiver (`../receiver`), the
 * parcel's desi and weight, and what the courier collects at the door.
 * The shop pays the shipping (its contract); one parcel, one piece.
 * Amounts with a dot, as the service reads them.
 */

export interface ArasOrderInput {
  /** Our code for the parcel: Aras finds it, tracks it and labels it by this. */
  integrationCode: string
  /** The order's number, as the waybill names it. */
  waybill: string
  receiver: Receiver
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  description: string
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
