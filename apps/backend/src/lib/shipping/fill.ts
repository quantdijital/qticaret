import { postcodeOf } from "./address"
import type { AddressRow } from "./address"
import { localPhone } from "./receiver"

/**
 * A parcel's addresses with their gaps filled from what the shop already
 * knows (adr/0054, 2026-11-05 addendum: ship first, fill in by itself).
 * Nothing here refuses: a part still missing is the carrier rule's to
 * name (`./receiver`), and only when the carrier
 * cannot do without it. Pure; the workflow reads the sources.
 */

/** A customer's own name and phone (their account). */
export interface Person {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

/** What the address data (TürkiyeAPI, `tr-address`) says of a place. */
export interface PlaceFacts {
  /** The mahalle's or köy's postcode; null when the address names none it knows. */
  postal_code: string | null
  /** The province's plate code ("34"). */
  plate: string | null
}

export interface FilledAddress {
  /** The address's own fields, the gaps filled. */
  address: AddressFields
  /** The province's plate code, for a carrier that finds the city by it; null when unknown. */
  plate: string | null
  /** The parts filled in, for the log. */
  filled: string[]
}

const FIELDS = [
  "first_name",
  "last_name",
  "company",
  "phone",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
] as const

/** An address's own fields, each written or null. */
export type AddressFields = Record<(typeof FIELDS)[number], string | null>

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/** An address's own fields only (no id, no metadata), each a string or null. */
export const addressFieldsOf = (row: AddressRow | null | undefined): AddressFields =>
  Object.fromEntries(FIELDS.map((field) => [field, row?.[field] ?? null])) as AddressFields

const named = (row: Person | AddressRow | null | undefined): boolean =>
  filled(row?.first_name) !== "" || filled(row?.last_name) !== ""

function common(address: AddressFields, place: PlaceFacts | null | undefined, done: string[]) {
  // The shop sells in Türkiye: an address without a country is a Turkish one
  if (filled(address.country_code) === "") {
    address.country_code = "tr"
    done.push("country_code")
  }
  const postal = postcodeOf(address.postal_code)
  if (!postal && place?.postal_code) {
    address.postal_code = place.postal_code
    done.push("postal_code")
  }
  const own = postcodeOf(address.postal_code).slice(0, 2)
  return own === "" ? (place?.plate ?? null) : own
}

/**
 * The receiver: the delivery address; a missing name from the billing
 * address or the customer's account; a phone no courier can dial replaced
 * by the billing address's or the account's (the delivery address's own
 * kept when none is better), and written as one (0 and ten digits); a
 * missing postcode from the address data.
 */
export function filledReceiver(
  shipping: AddressRow | null | undefined,
  known: {
    billing?: AddressRow | null | undefined
    customer?: Person | null | undefined
    place?: PlaceFacts | null | undefined
  } = {}
): FilledAddress {
  const address = addressFieldsOf(shipping)
  const done: string[] = []
  if (!named(address) && !filled(address.company)) {
    const other = [known.billing, known.customer].find((row) => named(row))
    if (other) {
      address.first_name = filled(other.first_name) || null
      address.last_name = filled(other.last_name) || null
      done.push("first_name")
    }
  }
  const own = localPhone(address.phone)
  const phone = own || localPhone(known.billing?.phone) || localPhone(known.customer?.phone)
  if (phone && phone !== filled(address.phone)) {
    address.phone = phone
    if (!own) {
      done.push("phone")
    }
  }
  const plate = common(address, known.place, done)
  return { address, plate, filled: done }
}
