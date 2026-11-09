import { z } from "zod"
import type { CustomerFields } from "./api/customer-edit"

// A Turkish landline, mobile or 0850 line in any common spelling, as the server reads it
const TR_PHONE = /^(?:\+?90|0)?[2-58]\d{9}$/

const isTrPhone = (value: string) => value === "" || TR_PHONE.test(value.replace(/[\s().-]/g, ""))

const F = "customers.form.errors"
const text = (max: number) => z.string().trim().max(max, "address.errors.tooLong")

/** The customer window's fields (2026-11-06); messages are i18n keys. */
export const customerSchema = z.object({
  first_name: text(100),
  last_name: text(100),
  email: z
    .string()
    .trim()
    .min(1, `${F}.emailRequired`)
    .max(254, "address.errors.tooLong")
    .refine((value) => z.email().safeParse(value).success, `${F}.email`),
  phone: z.string().trim().max(30, "address.errors.tooLong").refine(isTrPhone, `${F}.phone`),
  company_name: text(200),
  note: z.string().max(2000, `${F}.noteTooLong`),
})
export type CustomerForm = z.infer<typeof customerSchema>

const orNull = (value: string) => (value.trim() === "" ? null : value.trim())

/**
 * What a save sends: empty fields as none; the e-mail only for a guest (a
 * member's is their sign-in, theirs to change).
 */
export function customerFieldsOf(values: CustomerForm, guest: boolean): CustomerFields {
  return {
    first_name: orNull(values.first_name),
    last_name: orNull(values.last_name),
    ...(guest ? { email: values.email.trim() } : {}),
    phone: orNull(values.phone),
    company_name: orNull(values.company_name),
  }
}
