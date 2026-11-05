import type { AuthMode } from "@qticaret/ui"

/**
 * The sign-in forms' own first look, in the browser, before they are sent:
 * the rules the storefront's actions check again (`app/actions/account.ts`),
 * so an empty or mistyped field is said next to it at once. The message
 * keys are the actions'; an answer from the server lands the same way.
 */

export type AuthField =
  "first_name" | "last_name" | "email" | "phone" | "password" | "code" | "accept"

/** The fields in the forms' order: the first one wrong takes the focus. */
export const AUTH_FIELDS: readonly AuthField[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "password",
  "code",
  "accept",
]

/** Where a refusal belongs: the field its message sits under; the rest stand above the button. */
export const FIELD_OF_AUTH_ERROR: Record<string, AuthField> = {
  "checkout.email_invalid": "email",
  "account.email_required": "email",
  "account.email_taken": "email",
  "messaging.email_domain_refuses": "email",
  "checkout.phone_invalid": "phone",
  "checkout.name_required": "first_name",
  "account.password_required": "password",
  "auth.password_too_short": "password",
  "auth.password_too_long": "password",
  "auth.password_common": "password",
  "auth.password_contains_email": "password",
  "auth.password_breached": "password",
  "account.terms_required": "accept",
  "account.code_invalid": "code",
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// A mobile number, as the register action takes it (the account's SMS consent goes there)
const MOBILE = /^(?:\+90|0090|90|0)?5\d{9}$/
const CODE = /^[\w-]{10,128}$/
// The backend's policy is the rule (adr/0043); this only says the length first
const NEW_PASSWORD = 10

type Values = Partial<Record<AuthField | "terms", string>>

/** The first field the action would refuse and its message key; null when it would take them all. */
export function firstAuthProblem(
  values: Values,
  mode: AuthMode
): { field: AuthField; error: string } | null {
  const has = (field: AuthField) => field in values
  const value = (field: AuthField) => (values[field] ?? "").trim()
  const checks: [AuthField, boolean, string][] = [
    ["first_name", !has("first_name") || value("first_name") !== "", "checkout.name_required"],
    ["last_name", !has("last_name") || value("last_name") !== "", "checkout.name_required"],
    ["email", !has("email") || value("email") !== "", "account.email_required"],
    [
      "email",
      !has("email") || (EMAIL.test(value("email")) && value("email").length <= 254),
      "checkout.email_invalid",
    ],
    [
      "phone",
      !has("phone") || value("phone") === "" || MOBILE.test(value("phone").replace(/[\s()-]/g, "")),
      "checkout.phone_invalid",
    ],
    ["password", !has("password") || (values.password ?? "") !== "", "account.password_required"],
    [
      "password",
      !has("password") ||
        (mode !== "register" && mode !== "reset") ||
        (values.password ?? "").length >= NEW_PASSWORD,
      "auth.password_too_short",
    ],
    ["code", !has("code") || CODE.test(value("code")), "account.code_invalid"],
    // An unticked box is not in the form at all: the membership text's marker says it is asked
    ["accept", values.terms !== "1" || values.accept === "on", "account.terms_required"],
  ]
  const failed = checks.find(([, ok]) => !ok)
  return failed ? { field: failed[0], error: failed[2] } : null
}
