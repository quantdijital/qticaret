import { z } from "@medusajs/framework/zod"

/** Medusa's manual provider: the shop ships the parcel itself. */
export const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual"

/** Geliver as Medusa's fulfillment module names it: `<identifier>_<id>` from medusa-config. */
export const GELIVER_FULFILLMENT_PROVIDER_ID = "geliver_geliver"

/** The shop's own carrier contracts (adr/0035). */
export const ARAS_FULFILLMENT_PROVIDER_ID = "aras_aras"
export const YURTICI_FULFILLMENT_PROVIDER_ID = "yurtici_yurtici"

/** A carrier we open shipments with: an aggregator (Geliver) or the shop's own contract. */
export type CarrierName = "geliver" | "aras" | "yurtici"

const CARRIERS: Readonly<Record<string, CarrierName>> = {
  [GELIVER_FULFILLMENT_PROVIDER_ID]: "geliver",
  [ARAS_FULFILLMENT_PROVIDER_ID]: "aras",
  [YURTICI_FULFILLMENT_PROVIDER_ID]: "yurtici",
}

/** Providers that open shipments with a carrier: their parcels leave when the carrier picks them up. */
export const CARRIER_PROVIDERS: readonly string[] = Object.keys(CARRIERS)

export const isCarrierProvider = (providerId: string | null | undefined): boolean =>
  CARRIER_PROVIDERS.includes(providerId ?? "")

/** The carrier behind a fulfillment provider; null for the shop's own parcels (manual). */
export const carrierOf = (providerId: string | null | undefined): CarrierName | null =>
  CARRIERS[providerId ?? ""] ?? null

// Geliver names the carrier it bought the label from by code
const GELIVER_CARRIERS: Readonly<Record<string, string>> = {
  ARAS: "Aras Kargo",
  YURTICI: "Yurtiçi Kargo",
  MNG: "MNG Kargo",
  PTT: "PTT Kargo",
  SURAT: "Sürat Kargo",
  HEPSIJET: "HepsiJet",
  KOLAYGELSIN: "Kolay Gelsin",
}

/** The carrier a parcel went with, as a shopper reads it; null for the shop's own parcels. */
export function carrierNameOf(
  providerId: string | null | undefined,
  data: Record<string, unknown> | null | undefined
): string | null {
  switch (carrierOf(providerId)) {
    case "aras":
      return "Aras Kargo"
    case "yurtici":
      return "Yurtiçi Kargo"
    case "geliver": {
      const code = data?.["provider_code"]
      return typeof code === "string" ? (GELIVER_CARRIERS[code.toUpperCase()] ?? code) : null
    }
    case null:
      return null
  }
}

/** A tracking link fit to show: http(s), nothing that breaks out of an attribute. */
export const trackingUrlOf = (value: string | null | undefined): string | null =>
  value && /^https?:\/\/[^\s"<>]+$/.test(value) ? value : null

/**
 * What our "ship" workflow hands a carrier provider through Medusa's
 * `additional_data` (adr/0031): set by our route only, so Medusa's own
 * fulfillment route cannot open a carrier shipment without it.
 */
export const SHIP_ROUTE_MARK = "qt_ship"

export const shipInput = z.object({
  /** Geliver's sender address for the warehouse; a contract carrier knows the shop's own. */
  sender_address_id: z.string().min(1).nullable(),
  /** Kuruş the courier collects at the door (adr/0029); null when paid already. */
  cash_on_delivery: z.number().int().positive().nullable(),
})

export type ShipInput = z.infer<typeof shipInput>

/** Our route's input from a provider's `additional_data`; null when Medusa's own route called it. */
export function shipInputOf(additionalData: unknown): ShipInput | null {
  const read = shipInput.safeParse(
    (additionalData as Record<string, unknown> | null | undefined)?.[SHIP_ROUTE_MARK]
  )
  return read.success ? read.data : null
}
