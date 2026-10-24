import { z } from "@medusajs/framework/zod"

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
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "must be a postgres:// URL" }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: "must be a redis:// URL" }).optional(),
  STORE_CORS: originList,
  ADMIN_CORS: originList,
  AUTH_CORS: originList,
  JWT_SECRET: secret,
  COOKIE_SECRET: secret,
  PII_ENCRYPTION_KEY: key256,
  PII_HASH_KEY: key256,
})

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

  const result = envSchema.safeParse(input)
  if (result.success) {
    return result.data
  }

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".")
    return `  - ${key}: ${input[key] === undefined ? "is missing" : issue.message}`
  })
  throw new EnvValidationError(`Invalid environment configuration:\n${problems.join("\n")}`)
}
