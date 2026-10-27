import { z } from "zod"
import type { PaytrSave, ProviderAccount } from "@/features/settings/api/payments"

/** What the PayTR form holds; secrets start empty, the server never sends them. */
export interface PaytrFormValues {
  merchant_id: string
  merchant_key: string
  merchant_salt: string
  test_mode: boolean
}

export const paytrFormValues = (account: ProviderAccount | undefined): PaytrFormValues => ({
  merchant_id: account?.settings?.merchant_id ?? "",
  merchant_key: "",
  merchant_salt: "",
  // A new connection starts in test mode: no real card is charged until the shop says so
  test_mode: account?.settings?.test_mode ?? true,
})

/**
 * Identifies the stored account: a save, a check or a disconnect changes
 * it, and the card starts afresh from what is stored.
 */
export const paytrCardKey = (account: ProviderAccount | undefined): string =>
  account
    ? `${account.state}:${String(account.secrets_version)}:${account.updated_at ?? ""}:${account.verified_at ?? ""}`
    : "none"

/** Whether the form must ask for both secrets: none stored, unreadable, or a new shop number. */
export function secretsRequired(account: ProviderAccount | undefined, merchantId: string): boolean {
  if (!account || account.state === "not_configured" || account.state === "unreadable") {
    return true
  }
  return account.settings?.merchant_id !== merchantId.trim()
}

const P = "settings.payments.paytr"
// What PayTR's console copies out: printable, no spaces (the server checks the same)
const SECRET = /^[\x21-\x7E]{8,128}$/

/**
 * The form's rules, messages as i18n keys: a shop number in digits; the
 * secrets in PayTR's form when typed, and required when none are stored,
 * they cannot be read, or the shop number changed.
 */
export function paytrFormSchema(account: ProviderAccount | undefined) {
  return z
    .object({
      merchant_id: z
        .string()
        .refine((value) => /^\d{1,20}$/.test(value.trim()), `${P}.merchantIdInvalid`),
      merchant_key: z.string(),
      merchant_salt: z.string(),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      const required = secretsRequired(account, values.merchant_id)
      for (const name of ["merchant_key", "merchant_salt"] as const) {
        const value = values[name].trim()
        if (value === "" && required) {
          ctx.addIssue({ code: "custom", path: [name], message: `${P}.secretRequired` })
        } else if (value !== "" && !SECRET.test(value)) {
          ctx.addIssue({ code: "custom", path: [name], message: `${P}.secretFormat` })
        }
      }
    })
}

/** The body for a save: blank secrets are left out, so the stored ones stay. */
export function paytrSaveBody(values: PaytrFormValues): PaytrSave {
  const secrets = {
    ...(values.merchant_key.trim() ? { merchant_key: values.merchant_key.trim() } : {}),
    ...(values.merchant_salt.trim() ? { merchant_salt: values.merchant_salt.trim() } : {}),
  }
  return {
    settings: { merchant_id: values.merchant_id.trim(), test_mode: values.test_mode },
    ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
  }
}

/** Where PayTR posts payment results: the backend shares the panel's origin (adr/0022 §4). */
export const paytrNotificationUrl = (origin: string): string => `${origin}/hooks/paytr`

/** PayTR reaches public addresses only; a local or plain-http origin is for development. */
export function isPublicOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(
      url.hostname
    )
    return url.protocol === "https:" && !local
  } catch {
    return false
  }
}
