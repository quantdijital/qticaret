import { z } from "@medusajs/framework/zod"
import {
  EnvValidationError,
  isBareOrigin,
  isLocalEnv,
  isLoopbackUrl,
  key256,
  nodeEnv,
  originList,
  parseEnvWith,
  secret,
} from "@qticaret/server-kit"
import { CONTROL_PLANE_ENV, checkControlPlaneEnv } from "./control-plane/env"
import { CREDENTIALS_KEYS_ENV, checkCredentialKeysEnv } from "./integrations/credential-keys"
import { parseDsn } from "./error-tracking/dsn"
import { LOG_LEVELS } from "./logging/levels"
import { TURNSTILE_ENV, checkTurnstileEnv } from "./security/turnstile/env"

/**
 * Environment schema validated once at startup (docs/04): a missing or
 * malformed variable stops the process with a message naming every problem.
 * Error messages carry variable names only, never values, so secrets cannot
 * leak into logs. The shared building blocks live in `@qticaret/server-kit`.
 */

export { EnvValidationError, isLocalEnv, isLoopbackUrl }

// A program's absolute path, one line: run without a shell, never a command line
const programPath = z
  .string()
  .max(1024)
  .refine(
    (value) => value.startsWith("/") && !value.includes("\n") && !value.includes("\0"),
    "must be an absolute path"
  )

const envSchema = z.object({
  // No default: an unset NODE_ENV must not quietly mean "development" and
  // relax security settings (see isLocalEnv)
  NODE_ENV: nodeEnv,
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "must be a postgres:// URL" }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: "must be a redis:// URL" }).optional(),
  STORE_CORS: originList,
  ADMIN_CORS: originList,
  AUTH_CORS: originList,
  JWT_SECRET: secret,
  COOKIE_SECRET: secret,
  PII_ENCRYPTION_KEY: key256,
  PII_HASH_KEY: key256,
  // The shop's provider accounts (PayTR, iyzico) are stored encrypted under
  // them (adr/0027, adr/0061 Ek C17: one key, or a list newest first while
  // one rotates); required once deployed, locally the panel cannot save them
  ...CREDENTIALS_KEYS_ENV,
  // F12.6 (adr/0040): Medusa's MFA seals each staff member's TOTP secret with it
  AUTH_MFA_ENCRYPTION_KEY: key256.optional(),
  // Local only: `off` lets a developer sign in without 2FA; ignored when deployed
  ADMIN_MFA: z.enum(["on", "off"]).optional(),
  // Have I Been Pwned's breach list for new passwords (adr/0043): on in
  // production and staging, off locally unless `on`; `off` turns it off anywhere
  PASSWORD_BREACH_CHECK: z.enum(["on", "off"]).optional(),
  // F15.4 (adr/0045): GlitchTip's DSN for errors, self-hosted in Türkiye;
  // the OTLP collector for traces (instrumentation.ts). Both off when unset
  ERROR_TRACKING_DSN: z
    .string()
    .refine((value) => parseDsn(value) !== null, "must be a DSN: https://<key>@<host>/<project id>")
    .optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
  // The exporter prefers this one over the general endpoint: checked alike
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
  OTEL_SERVICE_NAME: z.string().max(100).optional(),
  // The deployed version, on each error event (CI sets it to the commit)
  RELEASE: z.string().max(100).optional(),
  // F15.3: per-IP limits a thousand times larger, for load tests sent from
  // one machine (`perIpScale`). Development, test and staging only
  LOAD_TEST: z.enum(["on", "off"]).optional(),
  // F15.9 (RFC 9116): where to report a security issue, `mailto:` or
  // `https:`, comma separated; security.txt answers 404 without it
  SECURITY_CONTACT: z.string().max(500).optional(),
  SECURITY_POLICY_URL: z.url({ protocol: /^https$/ }).optional(),
  // F18 (adr/0046 §5): shared with the storefront's server, which signs the
  // shopper's address with it on each Store API request; unset, only the
  // connection's own address counts
  STOREFRONT_IP_SECRET: secret.optional(),
  // adr/0048 ek 2026-11-03: where a publication or a settings save tells the
  // storefront's server to forget its shop-wide answers (`POST /api/yenile`,
  // signed with the secret above). Unset: the shop's canonical host once
  // deployed, http://localhost:8000 on a developer's machine. With no domain
  // bound, the panel's "Mağazayı görüntüle" opens it too (`lib/storefront/home.ts`):
  // a public address, so staff can open it
  STOREFRONT_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .refine(isBareOrigin, "must be an origin: scheme, host and port only")
    .optional(),
  // The backend's own public address: iyzico sends the shopper back to it
  // (`/hooks/iyzico/callback`). Required once deployed; locally localhost:9000
  BACKEND_URL: z.url({ protocol: /^https?$/ }).optional(),
  // Fake PayTR and iyzico servers in development and tests; the real addresses are fixed in code
  PAYTR_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  IYZICO_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake Aras or Yurtiçi on a developer's machine (adr/0035); refused when deployed
  ARAS_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  YURTICI_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake DHL eCommerce on a developer's machine and in tests; refused when deployed
  DHL_ECOMMERCE_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake Sürat Kargo on a developer's machine and in tests (Sürat has no test service); refused when deployed
  SURAT_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake PTT Kargo (both services) on a developer's machine and in tests; refused when deployed
  PTT_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // The platform's one app at DHL eCommerce's API portal (adr/0027 Ek 2026-11-26): each shop
  // connects its own customer number with it. Off until both are set; never logged
  DHL_ECOMMERCE_CLIENT_ID: z.string().max(200).optional(),
  DHL_ECOMMERCE_CLIENT_SECRET: z.string().max(200).optional(),
  // DHL eCommerce is suspended (the owner, 2026-11-26; adr/0027 Ek 2026-11-26 "askı"): built
  // and tested, but hidden and refused on this server until "true" (`lib/integrations/suspended.ts`)
  CARRIER_DHLECOMMERCE_ENABLED: z.enum(["true", "false"]).optional(),
  // F9 (adr/0036): where e-mail leaves us. Unset sends none; Mailpit only on
  // a developer's machine, Resend once deployed
  EMAIL_TRANSPORT: z.enum(["resend", "mailpit"]).optional(),
  // The platform's sender until the shop's own domain is verified
  EMAIL_FROM: z.email().max(254).optional(),
  RESEND_API_KEY: z
    .string()
    .regex(/^re_[A-Za-z0-9_]{8,200}$/, "must be a Resend API key (re_…)")
    .optional(),
  // Mailpit's web address (its HTTP send endpoint), and a fake Resend in tests
  MAILPIT_URL: z.url({ protocol: /^https?$/ }).optional(),
  RESEND_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // Signs Resend's delivery reports (`/hooks/resend`); without it the hook refuses all
  RESEND_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_[A-Za-z0-9+/=]{16,200}$/, "must be a Resend signing secret (whsec_…)")
    .optional(),
  // F10 M9: whether a shopper's e-mail domain must take mail (its MX); on
  // unless NODE_ENV=test, where the tests' made-up domains would fail it
  EMAIL_DOMAIN_CHECK: z.enum(["on", "off"]).optional(),
  // A fake Netgsm on a developer's machine (adr/0036)
  NETGSM_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F10.2 (adr/0037 §3): the shop's own OAuth clients, made at provisioning;
  // a provider is on once its values are all set
  GOOGLE_AUTH_CLIENT_ID: z.string().max(200).optional(),
  GOOGLE_AUTH_CLIENT_SECRET: z.string().max(200).optional(),
  GOOGLE_AUTH_CALLBACK_URL: z.url({ protocol: /^https?$/ }).optional(),
  // Apple's Services ID, team, key and its .p8 private key (PEM, `\n` for line breaks)
  APPLE_AUTH_CLIENT_ID: z.string().max(200).optional(),
  APPLE_AUTH_TEAM_ID: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "must be a 10-character team id")
    .optional(),
  APPLE_AUTH_KEY_ID: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "must be a 10-character key id")
    .optional(),
  APPLE_AUTH_PRIVATE_KEY: z.string().max(4000).optional(),
  APPLE_AUTH_CALLBACK_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake Apple in tests; refused when deployed
  APPLE_AUTH_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F10 M13 (adr/0038 §5): the platform's own Google OAuth client, one for every
  // shop; each shop connects its Google account with it. Off until both are set
  GOOGLE_OAUTH_CLIENT_ID: z.string().max(200).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().max(200).optional(),
  // adr/0071 §8: the AI core's daily abuse ceiling per shop, by kind of work. Unset:
  // lib/ai/limits.ts' default (text 500, image 100, video 10); a value may only lower it
  AI_DAILY_LIMIT_TEXT: z.coerce.number().int().min(0).max(100_000).optional(),
  AI_DAILY_LIMIT_IMAGE: z.coerce.number().int().min(0).max(100_000).optional(),
  AI_DAILY_LIMIT_VIDEO: z.coerce.number().int().min(0).max(100_000).optional(),
  // adr/0077 §7: the storefront's search intent calls per shop and day, on the shop's
  // own key, apart from the staff's; unset: 500 (lib/ai/limits.ts), 0 closes it
  AI_STORE_SEARCH_DAILY_LIMIT: z.coerce.number().int().min(0).max(100_000).optional(),
  // adr/0079 §8: the panel assistant's model calls a day, per shop and per staff member,
  // apart from the staff's text work; unset: 300 and 100 (lib/ai/limits.ts), a value may
  // only lower it, 0 closes it
  AI_ASSISTANT_DAILY_LIMIT: z.coerce.number().int().min(0).max(100_000).optional(),
  AI_ASSISTANT_USER_DAILY_LIMIT: z.coerce.number().int().min(0).max(100_000).optional(),
  // F10.11: the platform's API key for CrUX (Chrome's field data); off until set
  CRUX_API_KEY: z.string().max(200).optional(),
  // A fake Google (OAuth and Merchant API) in tests; refused when deployed
  GOOGLE_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F8 (adr/0034 §5): the platform's Paraşüt API client, asked of Paraşüt once; each
  // shop connects its own company with it. Off until both are set
  PARASUT_CLIENT_ID: z.string().max(200).optional(),
  PARASUT_CLIENT_SECRET: z.string().max(200).optional(),
  // A fake Paraşüt on a developer's machine and in tests; refused when deployed
  PARASUT_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // adr/0072: a fake BirFatura's file server (invoice PDFs) on a developer's machine
  // and in tests; refused when deployed
  BIRFATURA_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F14 (adr/0042): a fake Shopify for a migration on a developer's machine
  SHOPIFY_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F10.9: fake Meta Graph and GA4 Measurement Protocol in tests; refused when deployed
  META_GRAPH_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  GA4_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // adr/0008 Ek 2026-11-04: a fake TürkiyeAPI (address reference data) in tests,
  // its root with `/v2`; the real API is public and used everywhere else
  TURKIYEAPI_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // Medusa's own admin screens (/app): off; the shop works in our panel
  // (adr/0022 §3). "on" opens them for the platform team for a while (a
  // staff invite until F12 brings it to the panel)
  MEDUSA_ADMIN: z.enum(["on", "off"]).optional(),
  // Medusa's level names; unset means Medusa's default, `http`
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  // docs/13 §6: "off" keeps search engines out (robots.txt, noindex) on an
  // instance that is not the live shop; unset means off on staging only
  SEO_INDEXING: z.enum(["on", "off"]).optional(),
  // S3-compatible file storage (adr/0006, adr/0014): SeaweedFS in dev, a
  // cloud bucket when deployed; unset in test, where files stay local
  S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_FILE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((value) => !value.endsWith("/"), "must not end with a slash")
    .optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  // adr/0069 §4: the distribution's ffmpeg and ffprobe for product videos; unset, PATH's.
  // Missing, video uploads are closed (lib/media/video/tools.ts)
  FFMPEG_PATH: programPath.optional(),
  FFPROBE_PATH: programPath.optional(),
  // adr/0061 Ek C9: the control plane's plan documents (lib/control-plane/env.ts)
  ...CONTROL_PLANE_ENV,
  // adr/0044 Ek 2026-11-24: Cloudflare Turnstile's keys, the trusted CF-Connecting-IP
  ...TURNSTILE_ENV,
})

// Without these the file provider cannot work; the endpoint is only for
// non-AWS stores
const S3_REQUIRED = [
  "S3_REGION",
  "S3_BUCKET",
  "S3_FILE_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const

const deployedEnvSchema = envSchema.superRefine((env, ctx) => {
  // Sessions must survive restarts and be shared across instances (adr/0004)
  if ((env.NODE_ENV === "production" || env.NODE_ENV === "staging") && !env.REDIS_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["REDIS_URL"],
      message: "is required in production and staging",
    })
  }
  // Uploads and job results must outlive the instance (adr/0014); a half
  // configured store would fail at the first upload
  const s3Set = S3_REQUIRED.filter((name) => env[name] !== undefined)
  const deployed = env.NODE_ENV === "production" || env.NODE_ENV === "staging"
  checkControlPlaneEnv(env, !isLocalEnv(env), (path, message) => {
    ctx.addIssue({ code: "custom", path: [path], message })
  })
  if (deployed || s3Set.length > 0) {
    for (const name of S3_REQUIRED.filter((item) => env[item] === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: deployed
          ? "is required in production and staging"
          : "is required with the other S3 variables",
      })
    }
  }
  // Traces carry routes and statement shapes: over TLS once deployed, but
  // for a collector on the same machine (the F15 security review)
  for (const name of [
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
  ] as const) {
    const value = env[name]
    if (deployed && value?.startsWith("http:") && !isLoopbackUrl(value)) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "must be https in production and staging, unless on this machine",
      })
    }
  }
  // Results hold personal data: they travel over TLS once deployed
  for (const name of ["S3_ENDPOINT", "S3_FILE_URL"] as const) {
    if (deployed && env[name]?.startsWith("http:")) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "must be https in production and staging",
      })
    }
  }
  // Separate keys keep the lookup hash from weakening the encryption (adr/0009)
  if (env.PII_ENCRYPTION_KEY.toLowerCase() === env.PII_HASH_KEY.toLowerCase()) {
    ctx.addIssue({
      code: "custom",
      path: ["PII_HASH_KEY"],
      message: "must differ from PII_ENCRYPTION_KEY",
    })
  }
  checkCredentialKeysEnv(env, deployed, (path, message) => {
    ctx.addIssue({ code: "custom", path: [path], message })
  })
  // Staff 2FA is compulsory where the shop runs (adr/0040): no key, no start
  if (deployed && env.AUTH_MFA_ENCRYPTION_KEY === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["AUTH_MFA_ENCRYPTION_KEY"],
      message: "is required in production and staging",
    })
  }
  // Bots at the risky gates (adr/0044 Ek 2026-11-24): the pair, never a test key
  // live; the keys themselves are required at boot (assertTurnstileConfigured)
  checkTurnstileEnv(env, (path, message) => {
    ctx.addIssue({ code: "custom", path: [path], message })
  })
  // Unsigned, every shopper the storefront serves would count as its server's
  // one address (rate limits, booking's per-address share, consent proof):
  // compulsory where the shop runs (adr/0076 Ek D5, security review D-1)
  if (deployed && env.STOREFRONT_IP_SECRET === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["STOREFRONT_IP_SECRET"],
      message: "is required in production and staging",
    })
  }
  // The refresh signal crosses the network to the storefront: over TLS once deployed
  if (deployed && env.STOREFRONT_ORIGIN?.startsWith("http:")) {
    ctx.addIssue({
      code: "custom",
      path: ["STOREFRONT_ORIGIN"],
      message: "must be https in production and staging",
    })
  }
  if (deployed && !env.BACKEND_URL?.startsWith("https://")) {
    ctx.addIssue({
      code: "custom",
      path: ["BACKEND_URL"],
      message: "is required in production and staging, as an https:// address",
    })
  }
  // A chosen transport needs its sender and its address or key
  if (env.EMAIL_TRANSPORT !== undefined && env.EMAIL_FROM === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["EMAIL_FROM"],
      message: "is required with EMAIL_TRANSPORT",
    })
  }
  if (env.EMAIL_TRANSPORT === "resend" && env.RESEND_API_KEY === undefined) {
    ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "is required for resend" })
  }
  // Without it bounces are never heard of, and mail keeps going to dead addresses
  if (deployed && env.EMAIL_TRANSPORT === "resend" && env.RESEND_WEBHOOK_SECRET === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["RESEND_WEBHOOK_SECRET"],
      message: "is required for resend in production and staging",
    })
  }
  if (env.EMAIL_TRANSPORT === "mailpit" && (deployed || env.MAILPIT_URL === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["EMAIL_TRANSPORT"],
      message: "mailpit needs MAILPIT_URL and is not allowed on staging or production",
    })
  }
  if (
    env.LOAD_TEST === "on" &&
    env.NODE_ENV !== "staging" &&
    env.NODE_ENV !== "development" &&
    env.NODE_ENV !== "test"
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["LOAD_TEST"],
      message: "is allowed on development, test and staging only",
    })
  }
  // A deployed shop pays and ships at the provider's own address only. A fake server
  // is for an explicit development or test run: an unset NODE_ENV counts as live
  // (docs/04), so Medusa's CLI with a fake address needs NODE_ENV=development
  for (const name of [
    "PAYTR_BASE_URL",
    "IYZICO_BASE_URL",
    "ARAS_BASE_URL",
    "YURTICI_BASE_URL",
    "DHL_ECOMMERCE_BASE_URL",
    "SURAT_BASE_URL",
    "PTT_BASE_URL",
    "MAILPIT_URL",
    "RESEND_BASE_URL",
    "NETGSM_BASE_URL",
    "APPLE_AUTH_BASE_URL",
    "GOOGLE_BASE_URL",
    "PARASUT_BASE_URL",
    "BIRFATURA_BASE_URL",
    "SHOPIFY_BASE_URL",
    "META_GRAPH_BASE_URL",
    "GA4_BASE_URL",
    "TURKIYEAPI_BASE_URL",
  ] as const) {
    if (env[name] !== undefined && !isLocalEnv(env)) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "is allowed on development and test only (an unset NODE_ENV counts as live)",
      })
    }
  }
})

/** Whether search engines may index this instance (docs/13 §6: staging and previews stay out). */
export function isSearchIndexingOn(env: Pick<Env, "NODE_ENV" | "SEO_INDEXING">): boolean {
  return env.SEO_INDEXING ? env.SEO_INDEXING === "on" : env.NODE_ENV !== "staging"
}

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Blank values count as missing; only schema keys are read.
  return parseEnvWith(Object.keys(envSchema.shape), deployedEnvSchema, source)
}

export interface S3Settings {
  endpoint?: string
  region: string
  bucket: string
  fileUrl: string
  accessKeyId: string
  secretAccessKey: string
}

/** The S3 settings when configured (the schema makes them all or none), else null. */
export function s3Settings(env: Env): S3Settings | null {
  const { S3_REGION, S3_BUCKET, S3_FILE_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env
  if (!S3_REGION || !S3_BUCKET || !S3_FILE_URL || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return null
  }
  return {
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    region: S3_REGION,
    bucket: S3_BUCKET,
    fileUrl: S3_FILE_URL,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  }
}

const LOCAL_BACKEND_URL = "http://localhost:9000"

/** The backend's public origin, for addresses a provider sends the shopper back to. */
export function backendUrl(env: Pick<Env, "BACKEND_URL"> = parseEnv()): string {
  return new URL(env.BACKEND_URL ?? LOCAL_BACKEND_URL).origin
}

// The panel's dev server (`vite --strictPort`); deployed, it shares the backend's host (adr/0022)
const LOCAL_PANEL_URL = "http://localhost:5173"

// The storefront's dev server (`pnpm --filter storefront dev`)
const LOCAL_STOREFRONT_URL = "http://localhost:8000"

/**
 * The storefront server's origin as set (`STOREFRONT_ORIGIN`); on a
 * developer's machine localhost:8000 when unset, elsewhere null (the
 * caller decides: the refresh then takes the shop's canonical host).
 */
export function storefrontOrigin(
  env: Pick<Env, "STOREFRONT_ORIGIN" | "NODE_ENV"> = parseEnv()
): string | null {
  if (env.STOREFRONT_ORIGIN) {
    return new URL(env.STOREFRONT_ORIGIN).origin
  }
  return isLocalEnv(env) ? LOCAL_STOREFRONT_URL : null
}

/**
 * The origins the shop's files share with its pages, deployed: storage
 * served from the backend's (the panel's) or the storefront's origin lets
 * an uploaded file (an SVG logo, cleaned as it is) run under that origin's
 * cookies. Empty: apart, or not deployed (a developer's machine, tests).
 * A warning at start, never a refusal (docs/04).
 */
export function sharedFileOrigins(
  env: Pick<
    Env,
    | "NODE_ENV"
    | "BACKEND_URL"
    | "STOREFRONT_ORIGIN"
    | "S3_REGION"
    | "S3_BUCKET"
    | "S3_FILE_URL"
    | "S3_ACCESS_KEY_ID"
    | "S3_SECRET_ACCESS_KEY"
    | "S3_ENDPOINT"
  >
): string[] {
  if (isLocalEnv(env)) {
    return []
  }
  const files = s3Settings(env as Env)?.fileUrl
  if (!files) {
    return []
  }
  const origin = new URL(files).origin
  return [
    ...(env.BACKEND_URL && new URL(env.BACKEND_URL).origin === origin ? ["backend"] : []),
    ...(env.STOREFRONT_ORIGIN && new URL(env.STOREFRONT_ORIGIN).origin === origin
      ? ["storefront"]
      : []),
  ]
}

/** The panel's origin, for links staff open (an invitation). */
export function panelUrl(env: Pick<Env, "BACKEND_URL" | "NODE_ENV"> = parseEnv()): string {
  return isLocalEnv(env) && !env.BACKEND_URL ? LOCAL_PANEL_URL : backendUrl(env)
}
