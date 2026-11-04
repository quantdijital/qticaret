import type { ParcelLine } from "../parcel"
import type { GeliverAddress } from "./schemas"
import type { GeliverSenderInput } from "./client"
import type { GeliverRecipient } from "./shipments"

/**
 * A Turkish address as Geliver takes it (adr/0008 mapping): the province
 * is `province`, the district `city`, the neighbourhood `address_2`, and
 * the province's plate code the postcode's first two digits. Geliver's
 * SDK (`GeliverApp/geliver-js`: README, `requests.ts`) asks a phone of
 * both sides and a postcode of the sender only; the city is found by its
 * plate code or its name (adr/0054, 2026-11-05 addendum).
 */

export interface AddressRow {
  first_name?: string | null | undefined
  last_name?: string | null | undefined
  company?: string | null | undefined
  phone?: string | null | undefined
  address_1?: string | null | undefined
  address_2?: string | null | undefined
  city?: string | null | undefined
  province?: string | null | undefined
  postal_code?: string | null | undefined
  country_code?: string | null | undefined
}

/** An address Geliver cannot ship to or from: which part is missing. */
export class AddressIncomplete extends Error {
  constructor(readonly field: string) {
    super(`address: ${field} missing`)
  }
}

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/** A postcode as Turkey writes it (five digits), or "". */
export const postcodeOf = (value: string | null | undefined): string => {
  const postal = filled(value)
  return /^\d{5}$/.test(postal) ? postal : ""
}

/**
 * Every part Geliver asks for, or the first that is missing; the postcode
 * only when it is required (a sender). No country counts as Türkiye.
 */
function partsOf(address: AddressRow | null | undefined, zip: "required" | "optional") {
  const country = filled(address?.country_code).toLowerCase()
  if (country !== "" && country !== "tr") {
    throw new AddressIncomplete("country_code")
  }
  const street = [filled(address?.address_2), filled(address?.address_1)].filter(Boolean).join(", ")
  const postal = postcodeOf(address?.postal_code)
  const parts = {
    phone: filled(address?.phone),
    address_1: street,
    city: filled(address?.city),
    province: filled(address?.province),
    ...(zip === "required" ? { postal_code: postal } : {}),
  }
  for (const [field, value] of Object.entries(parts)) {
    if (!value) {
      throw new AddressIncomplete(field)
    }
  }
  return { ...parts, street, postal, plate: postal.slice(0, 2) }
}

/**
 * The recipient inline: its postcode when it has one; its city's plate
 * code from the postcode, else from the address data (`plate`), else the
 * city's name alone. The company stands for a missing name.
 */
export function geliverRecipientOf(
  address: AddressRow | null | undefined,
  email: string | null | undefined,
  plate?: string | null
): GeliverRecipient {
  const parts = partsOf(address, "optional")
  const person = [filled(address?.first_name), filled(address?.last_name)].filter(Boolean).join(" ")
  const name = person || filled(address?.company)
  if (!name) {
    throw new AddressIncomplete("first_name")
  }
  const cityCode = parts.plate || filled(plate)
  return {
    name,
    ...(email ? { email } : {}),
    phone: parts.phone,
    address1: parts.street,
    countryCode: "TR",
    cityName: parts.province,
    ...(cityCode ? { cityCode } : {}),
    districtName: parts.city,
    ...(parts.postal ? { zip: parts.postal } : {}),
  }
}

/** Marks the sender address that stands for one of the shop's warehouses. */
export const senderMarker = (locationId: string): string => `qt-${locationId}`

export function geliverSenderOf(
  location: { id: string; name: string; address?: AddressRow | null | undefined },
  contact: { name: string; email: string }
): GeliverSenderInput {
  const parts = partsOf(location.address, "required")
  return {
    name: filled(location.address?.company) || contact.name || location.name,
    email: contact.email,
    phone: parts.phone,
    address1: parts.street,
    countryCode: "TR",
    cityName: parts.province,
    cityCode: parts.plate,
    districtName: parts.city,
    zip: parts.postal,
    shortName: senderMarker(location.id),
  }
}

/** A stored sender address that still says what the warehouse's address says. */
export const sameSender = (stored: GeliverAddress, wanted: GeliverSenderInput): boolean =>
  stored.shortName === wanted.shortName &&
  stored.name === wanted.name &&
  stored.phone === wanted.phone &&
  stored.address1 === wanted.address1 &&
  stored.cityCode === wanted.cityCode &&
  stored.districtName === wanted.districtName &&
  stored.zip === wanted.zip

export interface OrderItemRow {
  id?: string
  title?: string | null
  product_title?: string | null
  quantity?: unknown
  variant?: {
    weight?: number | null
    length?: number | null
    width?: number | null
    height?: number | null
  } | null
}

/** An order's or cart's lines as the parcel reads them: the variant's weight and measures. */
export const parcelLinesOf = (
  items: readonly (OrderItemRow | null)[] | null | undefined
): ParcelLine[] =>
  (items ?? []).flatMap((item) =>
    item
      ? [
          {
            title: item.product_title ?? item.title ?? "",
            quantity: Number(item.quantity ?? 0),
            weight: item.variant?.weight ?? null,
            length: item.variant?.length ?? null,
            width: item.variant?.width ?? null,
            height: item.variant?.height ?? null,
          },
        ]
      : []
  )
