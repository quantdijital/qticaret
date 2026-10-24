import { randomBytes } from "node:crypto"
import { EnvValidationError, parseEnv } from "../env"

// Test-only values, generated per run so no fixed secret lives in the repo (docs/04)
const jwtSecret = "j".repeat(16) + Math.random().toString(36).padEnd(16, "x")
const cookieSecret = "c".repeat(16) + Math.random().toString(36).padEnd(16, "x")
const hexKey = () => randomBytes(32).toString("hex")

const validEnv = {
  DATABASE_URL: "postgres://postgres:pw@localhost:55432/qticaret",
  REDIS_URL: "redis://localhost:56379",
  STORE_CORS: "http://localhost:8000",
  ADMIN_CORS: "http://localhost:9000",
  AUTH_CORS: "http://localhost:9000,http://localhost:8000",
  JWT_SECRET: jwtSecret,
  COOKIE_SECRET: cookieSecret,
  PII_ENCRYPTION_KEY: hexKey(),
  PII_HASH_KEY: hexKey(),
}

function errorOf(source: Record<string, string | undefined>): string {
  try {
    parseEnv(source)
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error.message
    }
    throw error
  }
  throw new Error("expected parseEnv to throw")
}

describe("parseEnv", () => {
  it("returns typed config for a valid environment", () => {
    const env = parseEnv(validEnv)

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL)
    expect(env.NODE_ENV).toBe("development")
  })

  it("treats REDIS_URL as optional", () => {
    expect(parseEnv({ ...validEnv, REDIS_URL: undefined }).REDIS_URL).toBeUndefined()
  })

  it.each([undefined, "", "   "])("reports a variable as missing when it is %p", (value) => {
    expect(errorOf({ ...validEnv, JWT_SECRET: value })).toContain("JWT_SECRET: is missing")
  })

  it("rejects a short secret without echoing its value", () => {
    const message = errorOf({ ...validEnv, COOKIE_SECRET: "supersecret" })

    expect(message).toContain("COOKIE_SECRET: must be at least 32 characters")
    expect(message).not.toContain("supersecret")
  })

  it("rejects a non-postgres database URL", () => {
    expect(errorOf({ ...validEnv, DATABASE_URL: "mysql://localhost/db" })).toContain(
      "DATABASE_URL: must be a postgres:// URL"
    )
  })

  it("rejects a CORS list containing a non-http origin", () => {
    expect(
      errorOf({ ...validEnv, STORE_CORS: "http://localhost:8000,javascript:alert(1)" })
    ).toContain("STORE_CORS: must be a comma-separated list of http(s) origins")
  })

  it.each(["production", "staging"])("requires REDIS_URL in %s for the session store", (env) => {
    expect(errorOf({ ...validEnv, NODE_ENV: env, REDIS_URL: undefined })).toContain(
      "REDIS_URL: is required in production and staging"
    )
    expect(parseEnv({ ...validEnv, NODE_ENV: env }).REDIS_URL).toBe(validEnv.REDIS_URL)
  })

  it("requires 32-byte hex PII keys", () => {
    expect(errorOf({ ...validEnv, PII_ENCRYPTION_KEY: undefined })).toContain(
      "PII_ENCRYPTION_KEY: is missing"
    )
    expect(errorOf({ ...validEnv, PII_HASH_KEY: "ab".repeat(16) })).toContain(
      "PII_HASH_KEY: must be 64 hex characters (32 bytes)"
    )
  })

  it("lists every problem in a single error", () => {
    const message = errorOf({
      ...validEnv,
      DATABASE_URL: undefined,
      JWT_SECRET: "short",
      NODE_ENV: "prod",
    })

    expect(message).toContain("DATABASE_URL: is missing")
    expect(message).toContain("JWT_SECRET:")
    expect(message).toContain("NODE_ENV:")
  })

  it("never includes any provided value in the error message", () => {
    const source = { ...validEnv, ADMIN_CORS: "not-a-url" }
    const message = errorOf(source)

    for (const value of Object.values(source)) {
      expect(message).not.toContain(value)
    }
  })
})
