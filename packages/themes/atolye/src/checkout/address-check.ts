/**
 * The address form's own first look, in the browser, before it is sent:
 * the same rules the storefront's action checks again (`address-form.ts`),
 * so a missing or mistyped field is said next to it at once. The message
 * keys are the action's; the server's answer is shown the same way.
 */

export type AddressField =
  | "email"
  | "phone"
  | "first_name"
  | "last_name"
  | "province"
  | "district"
  | "neighborhood"
  | "address_1"

/** The fields in the form's order: the first one wrong takes the focus. */
export const ADDRESS_FIELDS: readonly AddressField[] = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "province",
  "district",
  "neighborhood",
  "address_1",
]

/** Where a refusal belongs: the field its message sits under. */
export const FIELD_OF_ERROR: Record<string, AddressField> = {
  "checkout.email_invalid": "email",
  "cart.email_required": "email",
  "messaging.email_domain_refuses": "email",
  "checkout.phone_invalid": "phone",
  "cart.phone_required": "phone",
  "checkout.name_required": "first_name",
  "checkout.location_required": "province",
  "checkout.street_required": "address_1",
  "cart.address_required": "address_1",
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^(?:\+90|0090|90|0)?[2-58]\d{9}$/

/** The first field the action would refuse and its message key; null when it would take them all. */
export function firstProblem(
  values: Partial<Record<AddressField, string>>
): { field: AddressField; error: string } | null {
  const value = (field: AddressField) => (values[field] ?? "").trim()
  const checks: [AddressField, boolean, string][] = [
    ["email", EMAIL.test(value("email")) && value("email").length <= 254, "checkout.email_invalid"],
    ["phone", PHONE.test(value("phone").replace(/[\s()-]/g, "")), "checkout.phone_invalid"],
    ["first_name", value("first_name").length > 0, "checkout.name_required"],
    ["last_name", value("last_name").length > 0, "checkout.name_required"],
    ["province", value("province").length > 0, "checkout.location_required"],
    ["district", value("district").length > 0, "checkout.location_required"],
    ["neighborhood", value("neighborhood").length > 0, "checkout.location_required"],
    ["address_1", value("address_1").length >= 5, "checkout.street_required"],
  ]
  const failed = checks.find(([field, ok]) => !ok && field in values)
  return failed ? { field: failed[0], error: failed[2] } : null
}
