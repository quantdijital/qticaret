import { z } from "zod"
import type { TrProvince } from "./api"

// A Turkish landline or mobile in any common spelling: +90 216 555 12 34, 0532..., 532...
const TR_PHONE = /^(?:\+?90|0)?[2-5]\d{9}$/

const isTrPhone = (value: string) => value === "" || TR_PHONE.test(value.replace(/[\s().-]/g, ""))

/**
 * A Turkish address's fields (F1.4) for a form, with the checks the
 * server makes that the form can make first; messages are i18n keys.
 */
export const trAddressShape = {
  address_1: z
    .string()
    .trim()
    .min(1, "address.errors.lineRequired")
    .max(200, "address.errors.tooLong"),
  address_2: z.string().trim().max(200, "address.errors.tooLong"),
  province: z.string().min(1, "address.errors.provinceRequired"),
  city: z.string().min(1, "address.errors.districtRequired"),
  postal_code: z
    .string()
    .trim()
    .regex(/^(\d{5})?$/, "address.errors.postalCodeInvalid"),
  phone: z
    .string()
    .trim()
    .max(30, "address.errors.tooLong")
    .refine(isTrPhone, "address.errors.phoneInvalid"),
}

/** A Turkish postal code starts with its province's plate code. */
export function postalCodeFits(
  values: { postal_code: string; province: string },
  provinces: readonly TrProvince[]
): boolean {
  const plate = provinces.find((each) => each.name === values.province)?.code
  return !values.postal_code || !plate || values.postal_code.startsWith(plate.padStart(2, "0"))
}

/** Names compared as Turkish readers do: "istanbul" is "İstanbul". */
export const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr")
