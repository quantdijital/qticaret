import { z } from "zod"

/**
 * The storefront's settings, read once and checked (docs/04): a missing or
 * malformed value stops the server with every problem named, never a value.
 * Server only: none of these reach the browser (no NEXT_PUBLIC_ variable).
 */
const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin)

const origins = z.string().transform((value, ctx) => {
  const listed = value.split(/[\s,]+/).filter((each) => each !== "")
  const parsed = listed.map((each) => URL.parse(each))
  if (parsed.some((url) => url === null || !/^https?:$/.test(url.protocol))) {
    ctx.addIssue({ code: "custom", message: "must be http(s) origins" })
    return z.NEVER
  }
  return parsed.flatMap((url) => (url ? [url.origin] : []))
})

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  MEDUSA_BACKEND_URL: origin,
  STOREFRONT_ORIGIN: origin,
  STOREFRONT_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_[A-Za-z0-9]{8,200}$/, "must be a publishable key (pk_…)")
    .optional(),
  STOREFRONT_IP_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  // adr/0046 §5: proxies in front of the storefront that append to
  // X-Forwarded-For; the shopper's address is the entry before theirs
  STOREFRONT_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),
  // D7: where a card provider's hosted form may be framed from (CSP frame-src),
  // space- or comma-separated origins; PayTR's when unset
  PAYMENT_FRAME_ORIGINS: origins.optional(),
  // D7: a card provider's own payment page the shopper is sent to (iyzico);
  // iyzico's live and sandbox pages when unset
  PAYMENT_REDIRECT_ORIGINS: origins.optional(),
  // adr/0049: the panel whose theme editor frames the storefront's preview
  // pages (CSP frame-ancestors on /onizleme only); the dev panel when unset
  PANEL_ORIGIN: origin.optional(),
})

export type StorefrontEnv = z.infer<typeof schema>

export class StorefrontEnvError extends Error {
  override readonly name = "StorefrontEnvError"
}

export function parseStorefrontEnv(
  source: Record<string, string | undefined> = process.env
): StorefrontEnv {
  const input: Record<string, string | undefined> = {}
  for (const key of Object.keys(schema.shape)) {
    const value = source[key]?.trim()
    input[key] = value === "" ? undefined : value
  }
  const result = schema.safeParse(input)
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    )
    throw new StorefrontEnvError(`Invalid storefront configuration:\n${problems.join("\n")}`)
  }
  const env = result.data
  // Deployed, the key and the signing secret are not optional
  if (env.NODE_ENV === "production") {
    // The proxies in front must be stated: a wrong count signs an address the shopper chose
    const missing = (
      [
        "STOREFRONT_PUBLISHABLE_KEY",
        "STOREFRONT_IP_SECRET",
        "STOREFRONT_TRUSTED_PROXY_HOPS",
      ] as const
    ).filter((key) => env[key] === undefined)
    if (missing.length > 0) {
      throw new StorefrontEnvError(
        `Invalid storefront configuration:\n${missing.map((key) => `  - ${key}: is missing`).join("\n")}`
      )
    }
  }
  return env
}

const PAYTR = "https://www.paytr.com"
// `pnpm dev:paytr`'s fake PayTR (packages/testing)
const FAKE_PAYTR = "http://127.0.0.1:9102"

/** The origins a card form may be framed from: the setting, else PayTR's (and the fake one's in development). */
export function paymentFrameOrigins(env: StorefrontEnv): string[] {
  if (env.PAYMENT_FRAME_ORIGINS && env.PAYMENT_FRAME_ORIGINS.length > 0) {
    return env.PAYMENT_FRAME_ORIGINS
  }
  return env.NODE_ENV === "development" ? [PAYTR, FAKE_PAYTR] : [PAYTR]
}

/** The panel that may frame a preview page (adr/0049): the setting, else the dev panel in development. */
export function panelOrigins(env: StorefrontEnv): string[] {
  if (env.PANEL_ORIGIN) {
    return [env.PANEL_ORIGIN]
  }
  return env.NODE_ENV === "development" ? ["http://localhost:5173"] : []
}

const IYZICO = ["https://cpp.iyzipay.com", "https://sandbox-cpp.iyzipay.com"]

/** The card providers' own pages a shopper may be sent to: the setting, else iyzico's. */
export function paymentRedirectOrigins(env: StorefrontEnv): string[] {
  return env.PAYMENT_REDIRECT_ORIGINS && env.PAYMENT_REDIRECT_ORIGINS.length > 0
    ? env.PAYMENT_REDIRECT_ORIGINS
    : IYZICO
}

let cached: StorefrontEnv | undefined

export const storefrontEnv = (): StorefrontEnv => (cached ??= parseStorefrontEnv())
