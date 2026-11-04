import { ValidationError } from "../errors"
import { AddressIncomplete } from "./geliver/mappers"
import type { AddressRow } from "./geliver/mappers"

/**
 * The parcel's receiver as a contract carrier takes it (adr/0035): a
 * Turkish address split the way Medusa keeps it (adr/0008: il in
 * `province`, ilçe in `city`, mahalle in `address_2`), the phone as a
 * courier dials it. Only what a carrier refuses without stops a parcel
 * (adr/0054, 2026-11-05 addendum); the gaps the order can fill are filled
 * before (`./fill`).
 */

export interface Receiver {
  name: string
  /** The street address with its mahalle, without the ilçe and the il. */
  address: string
  /** Mahalle, when the address names it. */
  quarter: string | null
  /** Ilçe and il; empty only for a carrier that takes the address without them. */
  town: string
  city: string
  phone: string
}

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/** Ten digits with the area code, from one spelling of a Turkish number; null when it is none. */
function tenDigits(text: string): string | null {
  let digits = text.replace(/\D/g, "")
  // 0090…: the international prefix spelled out
  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }
  // 90 and the national number, with or without its 0 (+90 0532…)
  if (
    digits.startsWith("90") &&
    (digits.length === 12 || (digits.length === 13 && digits[2] === "0"))
  ) {
    digits = digits.slice(2)
  }
  const ten = digits.startsWith("0") ? digits.slice(1) : digits
  return ten.length === 10 ? ten : null
}

/**
 * A Turkish phone as a courier dials it: 0 and ten digits. Takes the usual
 * spellings (+90, 0090, a leading 0, spaces, brackets, dashes) and, of
 * two numbers typed in one field, the first that is one; "" when none is.
 */
export function localPhone(value: string | null | undefined): string {
  for (const part of filled(value).split(/[/,;|]|\bveya\b|\bya da\b/iu)) {
    const ten = tenDigits(part)
    if (ten) {
      return `0${ten}`
    }
  }
  return ""
}

/** What a carrier needs of the receiver beyond the name, the street and the phone. */
export interface ReceiverNeeds {
  /** Il and ilçe as their own fields: Yurtiçi's are optional, Geliver's and Aras's are not. */
  place: "required" | "optional"
}

/**
 * The parcel's receiver from the delivery address, or the first part a
 * carrier cannot do without. No country counts as Türkiye (the shop sells
 * there); the company stands for a missing name; the mahalle alone is a
 * street address.
 */
export function receiverOf(
  address: AddressRow | null | undefined,
  needs: ReceiverNeeds = { place: "required" }
): Receiver {
  const country = filled(address?.country_code).toLowerCase()
  if (country !== "" && country !== "tr") {
    throw new AddressIncomplete("country_code")
  }
  const person = [filled(address?.first_name), filled(address?.last_name)].filter(Boolean).join(" ")
  const name = person || filled(address?.company)
  const quarter = filled(address?.address_2)
  const parts = {
    first_name: name,
    address_1: [quarter, filled(address?.address_1)].filter(Boolean).join(", "),
    ...(needs.place === "required"
      ? { city: filled(address?.city), province: filled(address?.province) }
      : {}),
    phone: localPhone(address?.phone),
  }
  for (const [field, value] of Object.entries(parts)) {
    if (!value) {
      throw new AddressIncomplete(field)
    }
  }
  return {
    name,
    address: parts.address_1,
    quarter: quarter === "" ? null : quarter,
    town: filled(address?.city),
    city: filled(address?.province),
    phone: parts.phone,
  }
}

// One key per part, so the shop reads which one to fill (the order page's address)
const RECEIVER_KEYS: Readonly<Record<string, string>> = {
  country_code: "shipping.receiver_abroad",
  first_name: "shipping.receiver_name_missing",
  address_1: "shipping.receiver_address_missing",
  city: "shipping.receiver_place_missing",
  province: "shipping.receiver_place_missing",
  phone: "shipping.receiver_phone_missing",
}

/** The shop's error for a part of the delivery address a carrier cannot do without. */
export const receiverError = (field: string): ValidationError =>
  new ValidationError(RECEIVER_KEYS[field] ?? "shipping.address_incomplete", {
    field: `shipping_address.${field}`,
  })

/** The receiver for a shipment, the shop told which part of the address to fill. */
export function shipmentReceiverOf(
  address: AddressRow | null | undefined,
  needs?: ReceiverNeeds
): Receiver {
  try {
    return receiverOf(address, needs)
  } catch (error) {
    if (error instanceof AddressIncomplete) {
      throw receiverError(error.field)
    }
    throw error
  }
}
