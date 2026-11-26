import { z } from "@medusajs/framework/zod"
import { isArasServiceUrl } from "../../lib/shipping/aras/client"
import { smtpSettings } from "../../lib/messaging/email/smtp-settings"
import { AI_CREDENTIAL_PROVIDERS, LOCAL_ONLY_PROVIDERS, offersLocalProviders } from "./providers-ai"

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
  // DHL eCommerce (formerly MNG Kargo): the shop's customer number and its "Online Şube"
  // password. The app keys are the platform's, from the server's environment (adr/0027 Ek
  // 2026-11-26); test and live accounts differ: switching asks for both again
  dhlecommerce: {
    settings: z.object({ test_mode: z.boolean() }).strict(),
    secrets: ["customer_number", "password"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{1,128}$/, "integration_credentials.secret_invalid"),
    identity: ["test_mode"],
    optional: [],
  },
  // Sürat Kargo's web service (docs/entegrasyonlar/surat.md): the login that opens parcels,
  // and the cari kodu with its web password that tracks, labels and deletes them, when Sürat
  // gave a second pair (both parts or neither; without it the first pair does all). Sürat has
  // no test service: no mode
  surat: {
    settings: z.object({}).strict(),
    secrets: ["username", "password", "cari_code", "web_password"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{1,128}$/, "integration_credentials.secret_invalid"),
    identity: [],
    optional: ["cari_code", "web_password"],
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
  // adr/0036 Ek 2026-11-10: the shop's own mail server; its password written once. A
  // relay on this machine may take mail without a login: the password is optional then
  smtp: {
    settings: smtpSettings,
    secrets: ["password"],
    // Any printable characters, spaces too: what the mail server's panel set
    secret: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[^\p{Cc}]+$/u, "integration_credentials.secret_invalid"),
    // Another server, port, security or login: the stored password never goes to it
    identity: ["host", "port", "security", "username"],
    optional: ["password"],
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
        // F10.11: what the shop allowed, and its Search Console property
        scopes: z.string().max(2000).optional(),
        gsc_site: z
          .string()
          .regex(
            /^(sc-domain:[a-z0-9.-]{1,253}|https?:\/\/[^\s/]{1,253}\/)$/,
            "google.gsc_site_invalid"
          )
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
  // F10.9 (adr/0038 §4): Meta's pixel for Conversions API events; a Test
  // Events code while the shop tries it out
  meta: {
    settings: z
      .object({
        pixel_id: z
          .string()
          .trim()
          .regex(/^\d{5,20}$/, "meta.pixel_id_invalid"),
        test_event_code: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{1,40}$/, "meta.test_event_code_invalid")
          .optional(),
      })
      .strict(),
    secrets: ["access_token"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{8,512}$/, "integration_credentials.secret_invalid"),
    identity: ["pixel_id"],
    optional: [],
  },
  // F10.9: GA4's web stream for Measurement Protocol events
  ga4: {
    settings: z
      .object({
        measurement_id: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^G-[A-Z0-9]{4,20}$/, "google_analytics.measurement_id_invalid"),
      })
      .strict(),
    secrets: ["api_secret"],
    secret: z
      .string()
      .trim()
      .regex(/^[\x21-\x7E]{8,512}$/, "integration_credentials.secret_invalid"),
    identity: ["measurement_id"],
    optional: [],
  },
  // F14 (adr/0042): the shop's own Shopify store, read once to move it here. An app the
  // owner makes in Shopify's Dev Dashboard and installs on the store (read scopes only);
  // its client id and secret buy a token for a day (client credentials grant)
  shopify: {
    settings: z
      .object({
        shop_domain: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/, "shopify.shop_domain_invalid"),
        client_id: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{16,64}$/, "shopify.client_id_invalid"),
      })
      .strict(),
    secrets: ["client_secret"],
    secret: secretField,
    identity: ["shop_domain", "client_id"],
    optional: [],
  },
  // adr/0072 §3: the token BirFatura sends when it pulls the shop's orders. Made by the
  // server and shown once (`POST /admin/einvoice/birfatura/token`), never typed in: the
  // accounts route refuses this provider. 128 random bits written as a GUID
  birfatura: {
    settings: z.object({}).strict(),
    secrets: ["token"],
    secret: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        "integration_credentials.secret_invalid"
      ),
    identity: [],
    optional: [],
  },
  // adr/0071 §3: the AI services, one key each (providers-ai.ts)
  ...AI_CREDENTIAL_PROVIDERS,
} as const satisfies Record<string, CredentialProvider>

export type CredentialProviderName = keyof typeof CREDENTIAL_PROVIDERS

// The fake AI service's account is no provider of a live shop
const offered = (value: string): boolean =>
  offersLocalProviders() || !LOCAL_ONLY_PROVIDERS.includes(value)

// Own keys only: `in` would also accept "toString"
export const isCredentialProvider = (value: string): value is CredentialProviderName =>
  Object.hasOwn(CREDENTIAL_PROVIDERS, value) && offered(value)

export const CREDENTIAL_PROVIDER_NAMES = (
  Object.keys(CREDENTIAL_PROVIDERS) as CredentialProviderName[]
).filter(offered)
