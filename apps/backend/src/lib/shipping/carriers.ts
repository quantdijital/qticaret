import { z } from "@medusajs/framework/zod"

/** Medusa's manual provider: the shop ships the parcel itself. */
export const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual"

/**
 * Our provider for the shop's own delivery at a flat price (adr/0087 §2):
 * the panel's "Kendi gönderimim" with a "Sabit ücret", priced by our quote.
 */
export const SHOP_FULFILLMENT_PROVIDER_ID = "shop_shop"

/** Its one option's `data.id`. */
export const SHOP_FLAT_OPTION = "shop-flat"

/** The shop carries the parcel itself: Medusa's manual provider, or ours. */
export const isOwnDelivery = (providerId: string | null | undefined): boolean =>
  providerId === MANUAL_FULFILLMENT_PROVIDER_ID || providerId === SHOP_FULFILLMENT_PROVIDER_ID

/** The shop's own carrier contracts (adr/0035). */
export const ARAS_FULFILLMENT_PROVIDER_ID = "aras_aras"
export const YURTICI_FULFILLMENT_PROVIDER_ID = "yurtici_yurtici"
/** DHL eCommerce Türkiye, formerly MNG Kargo (docs/entegrasyonlar/dhlecommerce.md). */
export const DHL_ECOMMERCE_FULFILLMENT_PROVIDER_ID = "dhlecommerce_dhlecommerce"

/** A carrier we open shipments with: the shop's own contract. */
export type CarrierName = "aras" | "yurtici" | "dhlecommerce"

/** The carriers we open shipments with, as tracked parcels name them. */
export const CARRIER_NAMES: readonly CarrierName[] = ["aras", "yurtici", "dhlecommerce"]

const CARRIERS: Readonly<Record<string, CarrierName>> = {
  [ARAS_FULFILLMENT_PROVIDER_ID]: "aras",
  [YURTICI_FULFILLMENT_PROVIDER_ID]: "yurtici",
  [DHL_ECOMMERCE_FULFILLMENT_PROVIDER_ID]: "dhlecommerce",
}

/** Providers that open shipments with a carrier: their parcels leave when the carrier picks them up. */
export const CARRIER_PROVIDERS: readonly string[] = Object.keys(CARRIERS)

export const isCarrierProvider = (providerId: string | null | undefined): boolean =>
  CARRIER_PROVIDERS.includes(providerId ?? "")

/**
 * The carrier behind a fulfillment provider; null for the shop's own
 * parcels (manual) and for a provider no longer registered (an old
 * parcel's, read only).
 */
export const carrierOf = (providerId: string | null | undefined): CarrierName | null =>
  CARRIERS[providerId ?? ""] ?? null

/**
 * The carrier a parcel went with, as a shopper reads it: an integration's,
 * or the name staff gave the shop's own parcel (`qt_carrier_name`, F18);
 * null when none is known.
 */
export function carrierNameOf(
  providerId: string | null | undefined,
  metadata?: Record<string, unknown> | null
): string | null {
  const named = metadata?.["qt_carrier_name"]
  switch (carrierOf(providerId)) {
    case "aras":
      return "Aras Kargo"
    case "yurtici":
      return "Yurtiçi Kargo"
    // Never "MNG Kargo": the brand is gone (the owner, 2026-11-26)
    case "dhlecommerce":
      return "DHL eCommerce"
    case null:
      return typeof named === "string" && named !== "" ? named : null
  }
}

/**
 * A fake carrier's own tracking page (`<base>/takip/<no>`), which the
 * fakes on a developer's machine serve: with a fake address set
 * (`ARAS_BASE_URL`, `YURTICI_BASE_URL`, `DHL_ECOMMERCE_BASE_URL`; refused when deployed), a parcel's
 * link opens the fake's page, as a live shop's opens the carrier's.
 */
export const fakeTrackingUrl = (fakeBase: string, number: string): string =>
  `${fakeBase.replace(/\/+$/, "")}/takip/${encodeURIComponent(number)}`

/** A tracking link fit to show: http(s), nothing that breaks out of an attribute. */
export const trackingUrlOf = (value: string | null | undefined): string | null =>
  value && /^https?:\/\/[^\s"<>]+$/.test(value) ? value : null

/**
 * What our "ship" workflow hands a carrier provider through Medusa's
 * `additional_data` (adr/0031): set by our route only, so Medusa's own
 * fulfillment route cannot open a carrier shipment without it.
 */
export const SHIP_ROUTE_MARK = "qt_ship"

const addressText = z.string().max(500).nullish()

/** An address's own fields, as our workflow filled them (`lib/shipping/fill`). */
const shipAddress = z.object({
  first_name: addressText,
  last_name: addressText,
  company: addressText,
  phone: addressText,
  address_1: addressText,
  address_2: addressText,
  city: addressText,
  province: addressText,
  postal_code: addressText,
  country_code: addressText,
})

export const shipInput = z.object({
  /** Kuruş the courier collects at the door (adr/0029); null when paid already. */
  cash_on_delivery: z.number().int().positive().nullable(),
  /**
   * The receiver: the delivery address with its gaps filled (adr/0054,
   * 2026-11-05 addendum); absent, the order's own. The order is not changed.
   */
  receiver: shipAddress.nullish(),
  /** The receiver's province plate code, from the address data, when it has no postcode. */
  plate: z
    .string()
    .regex(/^\d{2}$/)
    .nullish(),
  /** The order's e-mail: only DHL eCommerce reads it, which refuses a receiver without one. */
  email: z.email().max(254).nullish(),
})

export type ShipInput = z.infer<typeof shipInput>

/** Our route's input from a provider's `additional_data`; null when Medusa's own route called it. */
export function shipInputOf(additionalData: unknown): ShipInput | null {
  const read = shipInput.safeParse(
    (additionalData as Record<string, unknown> | null | undefined)?.[SHIP_ROUTE_MARK]
  )
  return read.success ? read.data : null
}
