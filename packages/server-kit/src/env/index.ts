import { z } from "zod"

/**
 * Building blocks of an environment schema validated once at startup
 * (docs/04): a missing or malformed variable stops the process with a
 * message naming every problem. Messages carry variable names only, never
 * values, so secrets cannot leak into logs.
 */

export const NODE_ENVS = ["development", "test", "staging", "production"] as const

// No default: an unset NODE_ENV must not quietly mean "development" and
// relax security settings (see isLocalEnv)
export const nodeEnv = z.enum(NODE_ENVS).optional()

export const SECRET_MIN_LENGTH = 32

export const isHttpOrigin = (value: string): boolean =>
  z.url({ protocol: /^https?$/ }).safeParse(value).success

/** Nothing but the origin: no path, query, fragment or credentials. */
export const isBareOrigin = (value: string): boolean => {
  if (!URL.canParse(value)) {
    return false
  }
  const url = new URL(value)
  return (
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === ""
  )
}

export const originList = z
  .string()
  .refine(
    (value) => value.split(",").every((origin) => isHttpOrigin(origin.trim())),
    "must be a comma-separated list of http(s) origins"
  )

export const secret = z
  .string()
  .min(SECRET_MIN_LENGTH, `must be at least ${String(SECRET_MIN_LENGTH)} characters`)

/** 32 random bytes as hex, the form `openssl rand -hex 32` produces (adr/0009). */
export const key256 = z.string().regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)")

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
export const isLoopbackUrl = (value: string): boolean => LOOPBACK_HOSTS.has(new URL(value).hostname)

/**
 * Only an explicit development or test environment counts as local; an unset
 * NODE_ENV gets production-grade settings such as Secure cookies.
 */
export function isLocalEnv(env: { NODE_ENV?: string | undefined }): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
}

export class EnvValidationError extends Error {
  override readonly name = "EnvValidationError"
}

/**
 * Reads only `keys` from `source` (blank values count as missing) and checks
 * them with `schema`; on failure throws one `EnvValidationError` listing
 * every problem by variable name.
 */
export function parseEnvWith<T>(
  keys: readonly string[],
  schema: z.ZodType<T>,
  source: Record<string, string | undefined>
): T {
  const input: Record<string, string | undefined> = {}
  for (const key of keys) {
    const value = source[key]?.trim()
    input[key] = value === "" ? undefined : value
  }

  const result = schema.safeParse(input)
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
