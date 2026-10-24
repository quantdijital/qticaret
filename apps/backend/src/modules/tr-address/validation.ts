import { normalizeTrPhone } from "../../lib/tr/phone"
import { postalCodePlate } from "../../lib/tr/postal-code"
import type TrAddressModuleService from "./service"
import type { TrAddressLookup } from "./service"

/**
 * Medusa address fields as used for Turkish addresses (F1.4):
 * province = il, city = ilçe, address_2 = mahalle, address_1 = street,
 * building and door number.
 */
export interface AddressFields {
  country_code?: string | null
  province?: string | null
  city?: string | null
  address_2?: string | null
  postal_code?: string | null
  phone?: string | null
}

export const TR_ADDRESS_ISSUES = [
  "province_not_found",
  "district_requires_province",
  "district_not_in_province",
  "neighborhood_requires_district",
  "neighborhood_not_in_district",
  "postal_code_invalid",
  "postal_code_province_mismatch",
  "postal_code_neighborhood_mismatch",
  "phone_invalid",
] as const

export type TrAddressIssueCode = (typeof TR_ADDRESS_ISSUES)[number]

export interface TrAddressIssue {
  field: keyof AddressFields
  /** i18n key for the storefront, e.g. `tr_address.district_not_in_province`. */
  code: `tr_address.${TrAddressIssueCode}`
}

export const isTrAddress = (address: AddressFields): boolean =>
  address.country_code?.toLowerCase() === "tr"

const present = (value: string | null | undefined): value is string => !!value?.trim()

/**
 * Checks what the address states, without demanding completeness: a cart
 * may carry only a country while the shopper is still typing. Missing
 * fields are enforced at checkout, not here.
 */
export function evaluateTrAddress(
  address: AddressFields,
  lookup: TrAddressLookup
): TrAddressIssue[] {
  const issues: TrAddressIssue[] = []
  const add = (field: keyof AddressFields, code: TrAddressIssueCode) =>
    issues.push({ field, code: `tr_address.${code}` })

  if (present(address.province) && !lookup.province) {
    add("province", "province_not_found")
  }
  if (present(address.city)) {
    if (!present(address.province)) {
      add("city", "district_requires_province")
    } else if (lookup.province && !lookup.district) {
      add("city", "district_not_in_province")
    }
  }
  // Neighborhoods are checked only where reference data covers the district.
  if (present(address.address_2) && lookup.districtHasNeighborhoods && !lookup.neighborhood) {
    add("address_2", "neighborhood_not_in_district")
  }
  if (present(address.address_2) && !present(address.city)) {
    add("address_2", "neighborhood_requires_district")
  }

  if (present(address.postal_code)) {
    const plate = postalCodePlate(address.postal_code)
    if (!plate) {
      add("postal_code", "postal_code_invalid")
    } else if (lookup.province && plate !== lookup.province.code) {
      add("postal_code", "postal_code_province_mismatch")
    } else if (
      lookup.neighborhood &&
      address.postal_code.trim() !== lookup.neighborhood.postal_code
    ) {
      add("postal_code", "postal_code_neighborhood_mismatch")
    }
  }

  if (present(address.phone) && !normalizeTrPhone(address.phone)) {
    add("phone", "phone_invalid")
  }
  return issues
}

/** Looks the address up in the reference data and returns its issues; non-TR addresses pass. */
export async function validateTrAddress(
  service: TrAddressModuleService,
  address: AddressFields
): Promise<TrAddressIssue[]> {
  if (!isTrAddress(address)) {
    return []
  }
  const lookup = await service.lookupAddress({
    ...(present(address.province) ? { province: address.province } : {}),
    ...(present(address.city) ? { district: address.city } : {}),
    ...(present(address.address_2) ? { neighborhood: address.address_2 } : {}),
  })
  return evaluateTrAddress(address, lookup)
}
