import { ValidationError } from "../errors"
import { AddressIncomplete } from "./geliver/mappers"
import type { AddressRow } from "./geliver/mappers"

/**
 * The parcel's receiver as a contract carrier takes it (adr/0035): a
 * Turkish address split the way Medusa keeps it (adr/0008: il in
 * `province`, ilçe in `city`, mahalle in `address_2`), the phone as a
 * courier dials it.
 */

export interface Receiver {
  name: string
  /** The street address with its mahalle, without the ilçe and the il. */
  address: string
  /** Mahalle, when the address names it. */
  quarter: string | null
  town: string
  city: string
  phone: string
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
export function receiverOf(address: AddressRow | null | undefined): Receiver {
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

/** The receiver for a shipment, the shop told which part of the address to fill. */
export function shipmentReceiverOf(address: AddressRow | null | undefined): Receiver {
  try {
    return receiverOf(address)
  } catch (error) {
    if (error instanceof AddressIncomplete) {
      throw new ValidationError("shipping.address_incomplete", {
        field: `shipping_address.${error.field}`,
      })
    }
    throw error
  }
}
