import { z } from "@medusajs/framework/zod"
import { LOG_LEVELS } from "./logging/levels"

/**
 * Environment schema validated once at startup (docs/04): a missing or
 * malformed variable stops the process with a message naming every problem.
 * Error messages carry variable names only, never values, so secrets cannot
 * leak into logs.
 */

const SECRET_MIN_LENGTH = 32

const isHttpOrigin = (value: string): boolean =>
  z.url({ protocol: /^https?$/ }).safeParse(value).success

const originList = z
  .string()
  .refine(
    (value) => value.split(",").every((origin) => isHttpOrigin(origin.trim())),
    "must be a comma-separated list of http(s) origins"
  )

const secret = z
  .string()
  .min(SECRET_MIN_LENGTH, `must be at least ${String(SECRET_MIN_LENGTH)} characters`)

// 32 random bytes as hex, the form `openssl rand -hex 32` produces (adr/0009)
const key256 = z.string().regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)")

const envSchema = z.object({
  // No default: an unset NODE_ENV must not quietly mean "development" and
  // relax security settings (see isLocalEnv)
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "must be a postgres:// URL" }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: "must be a redis:// URL" }).optional(),
  STORE_CORS: originList,
  ADMIN_CORS: originList,
  AUTH_CORS: originList,
  JWT_SECRET: secret,
  COOKIE_SECRET: secret,
  PII_ENCRYPTION_KEY: key256,
  PII_HASH_KEY: key256,
  // The shop's provider accounts (PayTR, iyzico) are stored encrypted with
  // it (adr/0027); required once deployed, locally the panel cannot save them
  CREDENTIALS_ENCRYPTION_KEY: key256.optional(),
  // F12.6 (adr/0040): Medusa's MFA seals each staff member's TOTP secret with it
  AUTH_MFA_ENCRYPTION_KEY: key256.optional(),
  // Local only: `off` lets a developer sign in without 2FA; ignored when deployed
  ADMIN_MFA: z.enum(["on", "off"]).optional(),
  // The backend's own public address: iyzico sends the shopper back to it
  // (`/hooks/iyzico/callback`). Required once deployed; locally localhost:9000
  BACKEND_URL: z.url({ protocol: /^https?$/ }).optional(),
  // Fake PayTR, iyzico and Geliver servers in development and tests; the real addresses are fixed in code
  PAYTR_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  IYZICO_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  GELIVER_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // A fake Aras or Yurtiçi on a developer's machine (adr/0035); refused when deployed
  ARAS_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  YURTICI_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
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
  // F10.13 (adr/0005): which content draft provider writes drafts. Only "fake"
  // so far (no model, development and tests); refused when deployed until a real
  // provider and its data processing agreement are chosen (docs/12)
  CONTENT_DRAFT_PROVIDER: z.enum(["fake"]).optional(),
  // How many drafts a month the shop may ask for
  CONTENT_DRAFT_MONTHLY_QUOTA: z.coerce.number().int().min(0).max(100_000).optional(),
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
  // F14 (adr/0042): a fake Shopify for a migration on a developer's machine
  SHOPIFY_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  // F10.9: fake Meta Graph and GA4 Measurement Protocol in tests; refused when deployed
  META_GRAPH_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  GA4_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
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
  const credentialsKey = env.CREDENTIALS_ENCRYPTION_KEY?.toLowerCase()
  if (deployed && credentialsKey === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["CREDENTIALS_ENCRYPTION_KEY"],
      message: "is required in production and staging",
    })
  }
  // Staff 2FA is compulsory where the shop runs (adr/0040): no key, no start
  if (deployed && env.AUTH_MFA_ENCRYPTION_KEY === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["AUTH_MFA_ENCRYPTION_KEY"],
      message: "is required in production and staging",
    })
  }
  // Provider secrets and personal data are kept apart: one key's loss or
  // rotation must not touch the other (adr/0027)
  if (
    credentialsKey !== undefined &&
    [env.PII_ENCRYPTION_KEY, env.PII_HASH_KEY].some((key) => key.toLowerCase() === credentialsKey)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["CREDENTIALS_ENCRYPTION_KEY"],
      message: "must differ from the PII keys",
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
  // A deployed shop pays and ships at the provider's own address only. A fake server
  // is for a developer's machine, where Medusa's CLI runs with NODE_ENV unset
  for (const name of [
    "PAYTR_BASE_URL",
    "IYZICO_BASE_URL",
    "GELIVER_BASE_URL",
    "ARAS_BASE_URL",
    "YURTICI_BASE_URL",
    "MAILPIT_URL",
    "RESEND_BASE_URL",
    "NETGSM_BASE_URL",
    "APPLE_AUTH_BASE_URL",
    "GOOGLE_BASE_URL",
    "PARASUT_BASE_URL",
    "SHOPIFY_BASE_URL",
    "META_GRAPH_BASE_URL",
    "GA4_BASE_URL",
    "CONTENT_DRAFT_PROVIDER",
  ] as const) {
    if (env[name] !== undefined && (env.NODE_ENV === "production" || env.NODE_ENV === "staging")) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "is not allowed on staging or production",
      })
    }
  }
})

/**
 * Only an explicit development or test environment counts as local; an unset
 * NODE_ENV gets production-grade settings such as Secure cookies.
 */
/** Whether search engines may index this instance (docs/13 §6: staging and previews stay out). */
export function isSearchIndexingOn(env: Pick<Env, "NODE_ENV" | "SEO_INDEXING">): boolean {
  return env.SEO_INDEXING ? env.SEO_INDEXING === "on" : env.NODE_ENV !== "staging"
}

export function isLocalEnv(env: Pick<Env, "NODE_ENV">): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
}

export type Env = z.infer<typeof envSchema>

export class EnvValidationError extends Error {
  override readonly name = "EnvValidationError"
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Blank values count as missing; only schema keys are read.
  const input: Record<string, string | undefined> = {}
  for (const key of Object.keys(envSchema.shape)) {
    const value = source[key]?.trim()
    input[key] = value === "" ? undefined : value
  }

  const result = deployedEnvSchema.safeParse(input)
  if (result.success) {
    return result.data
  }

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".")
    const missing = input[key] === undefined && issue.code !== "custom"
    return `  - ${key}: ${missing ? "is missing" : issue.message}`
  })
  throw new EnvValidationError(`Invalid environment configuration:\n${problems.join("\n")}`)
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

/** The panel's origin, for links staff open (an invitation). */
export function panelUrl(env: Pick<Env, "BACKEND_URL" | "NODE_ENV"> = parseEnv()): string {
  return isLocalEnv(env) && !env.BACKEND_URL ? LOCAL_PANEL_URL : backendUrl(env)
}
