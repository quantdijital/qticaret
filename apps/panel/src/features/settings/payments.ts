import { z } from "zod"
import type {
  AccountSave,
  IyzicoAccount,
  PaytrAccount,
  ProviderAccount,
} from "@/features/settings/api/payments"

/** Form helpers for the providers' pages (adr/0027): secrets start empty, the server never sends them. */

const A = "settings.payments.account"
// What a provider console copies out: printable, no spaces (the server checks the same)
const SECRET = /^[\x21-\x7E]{8,128}$/

/**
 * Identifies the stored account: a save, a check or a disconnect changes
 * it, and the form starts afresh from what is stored.
 */
export const accountKey = (account: ProviderAccount | undefined): string =>
  account
    ? `${account.state}:${String(account.secrets_version)}:${account.updated_at ?? ""}:${account.verified_at ?? ""}`
    : "none"

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Nothing usable stored: every secret is asked for. */
const nothingStored = (account: ProviderAccount | undefined): boolean =>
  !account || account.state === "not_configured" || account.state === "unreadable"

/** Each secret in the provider's form when typed, and required when `required`. */
function checkSecrets(
  values: Record<string, unknown>,
  names: readonly string[],
  required: boolean,
  ctx: z.RefinementCtx
) {
  for (const name of names) {
    const value = textOf(values[name])
    if (value === "" && required) {
      ctx.addIssue({ code: "custom", path: [name], message: `${A}.secretRequired` })
    } else if (value !== "" && !SECRET.test(value)) {
      ctx.addIssue({ code: "custom", path: [name], message: `${A}.secretFormat` })
    }
  }
}

/** The secrets typed in; blank ones are left out, so the stored ones stay. */
function typedSecrets(
  values: Record<string, unknown>,
  names: readonly string[]
): Pick<AccountSave, "secrets"> {
  const secrets = Object.fromEntries(
    names.map((name) => [name, textOf(values[name])] as const).filter(([, value]) => value !== "")
  )
  return Object.keys(secrets).length > 0 ? { secrets } : {}
}

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

// PayTR ---------------------------------------------------------------------

const PAYTR_SECRETS = ["merchant_key", "merchant_salt"] as const

/** What the PayTR form holds. */
export interface PaytrFormValues {
  merchant_id: string
  merchant_key: string
  merchant_salt: string
  test_mode: boolean
}

export const paytrFormValues = (account: PaytrAccount | undefined): PaytrFormValues => ({
  merchant_id: account?.settings?.merchant_id ?? "",
  merchant_key: "",
  merchant_salt: "",
  // A new connection starts in test mode: no real card is charged until the shop says so
  test_mode: account?.settings?.test_mode ?? true,
})

/** Whether the form must ask for both secrets: none stored, unreadable, or a new shop number. */
export function secretsRequired(account: PaytrAccount | undefined, merchantId: string): boolean {
  return nothingStored(account) || account?.settings?.merchant_id !== merchantId.trim()
}

/** A shop number in digits; the secrets as `checkSecrets` says. Messages are i18n keys. */
export function paytrFormSchema(account: PaytrAccount | undefined) {
  return z
    .object({
      merchant_id: z
        .string()
        .refine(
          (value) => /^\d{1,20}$/.test(value.trim()),
          "settings.payments.paytr.merchantIdInvalid"
        ),
      merchant_key: z.string(),
      merchant_salt: z.string(),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, PAYTR_SECRETS, secretsRequired(account, values.merchant_id), ctx)
    })
}

export const paytrSaveBody = (values: PaytrFormValues): AccountSave => ({
  settings: { merchant_id: values.merchant_id.trim(), test_mode: values.test_mode },
  ...typedSecrets({ ...values }, PAYTR_SECRETS),
})

/** Where PayTR posts payment results: the backend shares the panel's origin (adr/0022 §4). */
export const paytrNotificationUrl = (origin: string): string => `${origin}/hooks/paytr`

// iyzico --------------------------------------------------------------------

const IYZICO_SECRETS = ["api_key", "secret_key"] as const

export interface IyzicoFormValues {
  api_key: string
  secret_key: string
  test_mode: boolean
}

export const iyzicoFormValues = (account: IyzicoAccount | undefined): IyzicoFormValues => ({
  api_key: "",
  secret_key: "",
  // A new connection starts in the sandbox
  test_mode: account?.settings?.test_mode ?? true,
})

/** The sandbox has its own keys: leaving or entering it asks for both again, as the server does. */
export function iyzicoKeysRequired(account: IyzicoAccount | undefined, testMode: boolean): boolean {
  return nothingStored(account) || account?.settings?.test_mode !== testMode
}

/**
 * The keys as `checkSecrets` says; and a sandbox key (iyzico's start with
 * "sandbox-") refused with the sandbox off, where iyzico would not know it.
 */
export function iyzicoFormSchema(account: IyzicoAccount | undefined) {
  return z
    .object({ api_key: z.string(), secret_key: z.string(), test_mode: z.boolean() })
    .superRefine((values, ctx) => {
      checkSecrets(values, IYZICO_SECRETS, iyzicoKeysRequired(account, values.test_mode), ctx)
      if (!values.test_mode && values.api_key.trim().startsWith("sandbox-")) {
        ctx.addIssue({
          code: "custom",
          path: ["api_key"],
          message: "settings.payments.iyzico.sandboxKeyLive",
        })
      }
    })
}

export const iyzicoSaveBody = (values: IyzicoFormValues): AccountSave => ({
  settings: { test_mode: values.test_mode },
  ...typedSecrets({ ...values }, IYZICO_SECRETS),
})

/** Where iyzico posts its notifications, set in iyzico's panel (the route waits for the real account). */
export const iyzicoWebhookUrl = (origin: string): string => `${origin}/hooks/iyzico/webhook`
