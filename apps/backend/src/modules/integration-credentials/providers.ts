import { z } from "@medusajs/framework/zod"

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
  },
  // iyzico panel > API keys. The sandbox has its own keys: switching asks for both again
  iyzico: {
    settings: z.object({ test_mode: z.boolean() }).strict(),
    secrets: ["api_key", "secret_key"],
    secret: secretField,
    identity: ["test_mode"],
  },
} as const satisfies Record<string, CredentialProvider>

export type CredentialProviderName = keyof typeof CREDENTIAL_PROVIDERS

// Own keys only: `in` would also accept "toString"
export const isCredentialProvider = (value: string): value is CredentialProviderName =>
  Object.hasOwn(CREDENTIAL_PROVIDERS, value)

export const CREDENTIAL_PROVIDER_NAMES = Object.keys(
  CREDENTIAL_PROVIDERS
) as CredentialProviderName[]
