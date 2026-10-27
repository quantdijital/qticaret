import type { ParcelLine } from "../parcel"
import type { GeliverAddress } from "./schemas"
import type { GeliverSenderInput } from "./client"
import type { GeliverRecipient } from "./shipments"

/**
 * A Turkish address as Geliver takes it (adr/0008 mapping): the province
 * is `province`, the district `city`, the neighbourhood `address_2`, and
 * the province's plate code the postcode's first two digits.
 */

export interface AddressRow {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  phone?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
}

/** An address Geliver cannot ship to or from: which part is missing. */
export class AddressIncomplete extends Error {
  constructor(readonly field: string) {
    super(`address: ${field} missing`)
  }
}

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/** Every part Geliver asks for, or the first that is missing. */
function partsOf(address: AddressRow | null | undefined) {
  const postal = filled(address?.postal_code)
  const parts = {
    phone: filled(address?.phone),
    address_1: filled(address?.address_1),
    city: filled(address?.city),
    province: filled(address?.province),
    postal_code: /^\d{5}$/.test(postal) ? postal : "",
  }
  if ((address?.country_code ?? "").toLowerCase() !== "tr") {
    throw new AddressIncomplete("country_code")
  }
  for (const [field, value] of Object.entries(parts)) {
    if (!value) {
      throw new AddressIncomplete(field)
    }
  }
  const street = [filled(address?.address_2), parts.address_1].filter(Boolean).join(", ")
  return { ...parts, street, plate: parts.postal_code.slice(0, 2) }
}

export function geliverRecipientOf(
  address: AddressRow | null | undefined,
  email: string | null | undefined
): GeliverRecipient {
  const parts = partsOf(address)
  const name = [filled(address?.first_name), filled(address?.last_name)].filter(Boolean).join(" ")
  if (!name) {
    throw new AddressIncomplete("first_name")
  }
  return {
    name,
    ...(email ? { email } : {}),
    phone: parts.phone,
    address1: parts.street,
    countryCode: "TR",
    cityName: parts.province,
    cityCode: parts.plate,
    districtName: parts.city,
    zip: parts.postal_code,
  }
}

/** Marks the sender address that stands for one of the shop's warehouses. */
export const senderMarker = (locationId: string): string => `qt-${locationId}`

export function geliverSenderOf(
  location: { id: string; name: string; address?: AddressRow | null | undefined },
  contact: { name: string; email: string }
): GeliverSenderInput {
  const parts = partsOf(location.address)
  return {
    name: filled(location.address?.company) || contact.name || location.name,
    email: contact.email,
    phone: parts.phone,
    address1: parts.street,
    countryCode: "TR",
    cityName: parts.province,
    cityCode: parts.plate,
    districtName: parts.city,
    zip: parts.postal_code,
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
