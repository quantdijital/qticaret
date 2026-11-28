/**
 * A Turkish address as our rows hold it (adr/0008 mapping): the province
 * is `province`, the district `city`, the neighbourhood `address_2`, and
 * the province's plate code the postcode's first two digits.
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

/** An address a carrier cannot ship to or from: which part is missing. */
export class AddressIncomplete extends Error {
  constructor(readonly field: string) {
    super(`address: ${field} missing`)
  }
}

/** A postcode as Turkey writes it (five digits), or "". */
export const postcodeOf = (value: string | null | undefined): string => {
  const postal = (value ?? "").trim()
  return /^\d{5}$/.test(postal) ? postal : ""
}
