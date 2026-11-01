import { z } from "zod"

/**
 * The storefront's settings, read once and checked (docs/04): a missing or
 * malformed value stops the server with every problem named, never a value.
 * Server only: none of these reach the browser (no NEXT_PUBLIC_ variable).
 */
const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin)

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
    const missing = (["STOREFRONT_PUBLISHABLE_KEY", "STOREFRONT_IP_SECRET"] as const).filter(
      (key) => env[key] === undefined
    )
    if (missing.length > 0) {
      throw new StorefrontEnvError(
        `Invalid storefront configuration:\n${missing.map((key) => `  - ${key}: is missing`).join("\n")}`
      )
    }
  }
  return env
}

let cached: StorefrontEnv | undefined

export const storefrontEnv = (): StorefrontEnv => (cached ??= parseStorefrontEnv())
