import { z } from "@medusajs/framework/zod"
import { isArasServiceUrl } from "../../lib/shipping/aras/client"

/**
 * Which providers the shop can connect and what each one asks for
 * (adr/0027). Fields are fixed here; there is no free key/value storage.
 * Error messages are i18n keys.
 */

export interface CredentialProvider {
  /** Fields shown in the panel and stored in the clear. */
  settings: z.ZodObject
  /** Fields written once and never read back. */
  secrets: readonly string[]
  secret: z.ZodType<string>
  /** Settings naming the account itself: changing one asks for every secret again. */
  identity: readonly string[]
  /** Secrets the shop may leave out, all together or none: a second account it may not have. */
  optional: readonly string[]
}

// Printable ASCII without spaces: what a provider console copies out
const secretField = z
  .string()
  .trim()
  .regex(/^[\x21-\x7E]{8,128}$/, "integration_credentials.secret_invalid")

export const CREDENTIAL_PROVIDERS = {
  // PayTR Mağaza Paneli > Destek & Kurulum > Entegrasyon Bilgileri
  paytr: {
    settings: z
      .object({
        merchant_id: z
          .string()
          .trim()
          .regex(/^\d{1,20}$/, "paytr.merchant_id_invalid"),
        test_mode: z.boolean(),
      })
      .strict(),
    secrets: ["merchant_key", "merchant_salt"],
    secret: secretField,
    identity: ["merchant_id"],
    optional: [],
  },
  // iyzico panel > API keys. The sandbox has its own keys: switching asks for both again
  iyzico: {
    settings: z.object({ test_mode: z.boolean() }).strict(),
    secrets: ["api_key", "secret_key"],
    secret: secretField,
    identity: ["test_mode"],
    optional: [],
  },
  // Geliver panel > API tokens (adr/0031). Test shipments use the same token: a flag per shipment
  geliver: {
    settings: z.object({ test_mode: z.boolean() }).strict(),
    secrets: ["api_token"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{16,2048}$/, "integration_credentials.secret_invalid"),
    identity: [],
    optional: [],
  },
  // Aras Kargo's customer service account, given with the shop's contract (adr/0035)
  aras: {
    settings: z
      .object({
        test_mode: z.boolean(),
        customer_code: z
          .string()
          .trim()
          .regex(/^[0-9A-Za-z]{0,20}$/, "aras.customer_code_invalid"),
        // Only Aras's own hosts: the server calls it with the shop's password
        service_url: z
          .string()
          .trim()
          .refine((value) => value === "" || isArasServiceUrl(value), "aras.service_url_invalid"),
      })
      .strict(),
    secrets: ["username", "password"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{1,128}$/, "integration_credentials.secret_invalid"),
    // Another code, address or mode is another account: the logins again, a check, an alert
    identity: ["customer_code", "service_url", "test_mode"],
    optional: [],
  },
  // Yurtiçi Kargo's web service logins, given with the shop's contract (adr/0035). Parcels
  // paid at the door go out on a separate account Yurtiçi gives for them; test logins differ
  yurtici: {
    settings: z.object({ test_mode: z.boolean() }).strict(),
    secrets: ["username", "password", "cod_username", "cod_password"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{1,128}$/, "integration_credentials.secret_invalid"),
    identity: ["test_mode"],
    optional: ["cod_username", "cod_password"],
  },
  // Netgsm's SMS account (adr/0036): the shop's own, its sender name registered to its company
  netgsm: {
    settings: z
      .object({
        msgheader: z
          .string()
          .trim()
          .regex(/^[0-9A-Za-zÇĞİÖŞÜçğıöşü .-]{2,11}$/, "netgsm.msgheader_invalid"),
        // F10 M11: the number İYS gave the shop's brand; consents reach İYS under it
        iys_brand_code: z
          .string()
          .trim()
          .regex(/^\d{1,12}$/, "netgsm.iys_brand_code_invalid")
          .optional(),
      })
      .strict(),
    secrets: ["usercode", "password"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{1,128}$/, "integration_credentials.secret_invalid"),
    identity: [],
    optional: [],
  },
  // F10 M13 (adr/0038 §5): the shop's Google account, connected through the
  // platform's OAuth client: the refresh token comes from Google's consent
  // screen, never typed. The Merchant Center account and its API data source
  // follow once the shop names the account
  google: {
    settings: z
      .object({
        email: z.email().max(254).optional(),
        merchant_id: z
          .string()
          .trim()
          .regex(/^\d{1,20}$/, "google.merchant_id_invalid")
          .optional(),
        data_source: z
          .string()
          .regex(/^accounts\/\d{1,20}\/dataSources\/\d{1,20}$/)
          .optional(),
      })
      .strict(),
    secrets: ["refresh_token"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{8,512}$/, "integration_credentials.secret_invalid"),
    identity: [],
    optional: [],
  },
} as const satisfies Record<string, CredentialProvider>

export type CredentialProviderName = keyof typeof CREDENTIAL_PROVIDERS

// Own keys only: `in` would also accept "toString"
export const isCredentialProvider = (value: string): value is CredentialProviderName =>
  Object.hasOwn(CREDENTIAL_PROVIDERS, value)

export const CREDENTIAL_PROVIDER_NAMES = Object.keys(
  CREDENTIAL_PROVIDERS
) as CredentialProviderName[]
