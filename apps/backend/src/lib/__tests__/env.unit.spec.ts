import { randomBytes } from "node:crypto"
import { EnvValidationError, backendUrl, isLocalEnv, parseEnv, s3Settings } from "../env"

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

// Generated per run like the secrets above
const s3Env = {
  S3_REGION: "us-east-1",
  S3_BUCKET: "qticaret",
  S3_FILE_URL: "https://files.example.com/qticaret",
  S3_ACCESS_KEY_ID: randomBytes(8).toString("hex"),
  S3_SECRET_ACCESS_KEY: randomBytes(20).toString("hex"),
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
    expect(env.NODE_ENV).toBeUndefined()
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
    expect(
      parseEnv({
        ...validEnv,
        ...s3Env,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        BACKEND_URL: "https://api.example.com",
        NODE_ENV: env,
      }).REDIS_URL
    ).toBe(validEnv.REDIS_URL)
  })

  it.each(["production", "staging"])("requires the backend's https address in %s", (env) => {
    expect(errorOf({ ...validEnv, NODE_ENV: env })).toContain(
      "BACKEND_URL: is required in production and staging, as an https:// address"
    )
    expect(
      errorOf({ ...validEnv, NODE_ENV: env, BACKEND_URL: "http://api.example.com" })
    ).toContain("BACKEND_URL: is required in production and staging")
  })

  it("puts the backend on localhost:9000 locally, and reads only its origin", () => {
    expect(backendUrl({ BACKEND_URL: undefined })).toBe("http://localhost:9000")
    expect(backendUrl({ BACKEND_URL: "https://api.example.com/x/" })).toBe(
      "https://api.example.com"
    )
  })

  it.each(["production", "staging"])("requires the S3 variables in %s", (env) => {
    expect(errorOf({ ...validEnv, NODE_ENV: env })).toContain(
      "S3_BUCKET: is required in production and staging"
    )
  })

  it("refuses a half-configured S3 store and reads a complete one", () => {
    expect(errorOf({ ...validEnv, S3_BUCKET: "qticaret" })).toContain(
      "S3_REGION: is required with the other S3 variables"
    )
    expect(errorOf({ ...validEnv, ...s3Env, S3_FILE_URL: "https://files.example.com/" })).toContain(
      "S3_FILE_URL: must not end with a slash"
    )
    expect(s3Settings(parseEnv(validEnv))).toBeNull()
    expect(s3Settings(parseEnv({ ...validEnv, ...s3Env }))).toMatchObject({
      bucket: "qticaret",
      fileUrl: s3Env.S3_FILE_URL,
    })
  })

  it.each(["production", "staging"])(
    "requires the provider account key in %s (adr/0027)",
    (env) => {
      expect(errorOf({ ...validEnv, ...s3Env, NODE_ENV: env })).toContain(
        "CREDENTIALS_ENCRYPTION_KEY: is required in production and staging"
      )
      expect(parseEnv(validEnv).CREDENTIALS_ENCRYPTION_KEY).toBeUndefined()
    }
  )

  it("keeps the provider account key apart from the PII keys", () => {
    expect(
      errorOf({ ...validEnv, CREDENTIALS_ENCRYPTION_KEY: validEnv.PII_HASH_KEY.toUpperCase() })
    ).toContain("CREDENTIALS_ENCRYPTION_KEY: must differ from the PII keys")
    expect(errorOf({ ...validEnv, CREDENTIALS_ENCRYPTION_KEY: "ab" })).toContain(
      "CREDENTIALS_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)"
    )
  })

  it("lets a fake iyzico address on a developer's machine only", () => {
    const fake = { IYZICO_BASE_URL: "http://127.0.0.1:4011" }

    expect(parseEnv({ ...validEnv, ...fake, NODE_ENV: "test" }).IYZICO_BASE_URL).toBe(
      fake.IYZICO_BASE_URL
    )
    // Medusa's CLI (`medusa user`, `db:migrate`) runs with NODE_ENV unset
    expect(parseEnv({ ...validEnv, ...fake }).IYZICO_BASE_URL).toBe(fake.IYZICO_BASE_URL)
    expect(
      errorOf({
        ...validEnv,
        ...s3Env,
        ...fake,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "staging",
      })
    ).toContain("IYZICO_BASE_URL: is not allowed on staging or production")
  })

  it("lets a fake Geliver address on a developer's machine only", () => {
    const fake = { GELIVER_BASE_URL: "http://127.0.0.1:9103/api/v1" }

    expect(parseEnv({ ...validEnv, ...fake, NODE_ENV: "test" }).GELIVER_BASE_URL).toBe(
      fake.GELIVER_BASE_URL
    )
    expect(
      errorOf({
        ...validEnv,
        ...s3Env,
        ...fake,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "production",
      })
    ).toContain("GELIVER_BASE_URL: is not allowed on staging or production")
  })

  it("sends e-mail through Mailpit on a developer's machine only, and through Resend with its key", () => {
    const mailpit = {
      EMAIL_TRANSPORT: "mailpit",
      MAILPIT_URL: "http://127.0.0.1:58025",
      EMAIL_FROM: "bildirim@magaza.test",
    }
    const deployed = { ...validEnv, ...s3Env, CREDENTIALS_ENCRYPTION_KEY: hexKey() }

    expect(parseEnv({ ...validEnv, ...mailpit, NODE_ENV: "test" }).EMAIL_TRANSPORT).toBe("mailpit")
    expect(errorOf({ ...deployed, ...mailpit, NODE_ENV: "production" })).toContain(
      "MAILPIT_URL: is not allowed on staging or production"
    )
    expect(
      errorOf({ ...validEnv, EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a@b.example" })
    ).toContain("RESEND_API_KEY: is required for resend")
    expect(errorOf({ ...validEnv, EMAIL_TRANSPORT: "resend" })).toContain(
      "EMAIL_FROM: is required with EMAIL_TRANSPORT"
    )
  })

  it("lets a fake PayTR address on a developer's machine only", () => {
    const fake = { PAYTR_BASE_URL: "http://127.0.0.1:4010" }

    expect(parseEnv({ ...validEnv, ...fake, NODE_ENV: "test" }).PAYTR_BASE_URL).toBe(
      fake.PAYTR_BASE_URL
    )
    expect(parseEnv({ ...validEnv, ...fake }).PAYTR_BASE_URL).toBe(fake.PAYTR_BASE_URL)
    expect(
      errorOf({
        ...validEnv,
        ...s3Env,
        ...fake,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "production",
      })
    ).toContain("PAYTR_BASE_URL: is not allowed on staging or production")
  })

  it("rejects identical PII encryption and hash keys", () => {
    const key = hexKey()
    expect(
      errorOf({ ...validEnv, PII_ENCRYPTION_KEY: key, PII_HASH_KEY: key.toUpperCase() })
    ).toContain("PII_HASH_KEY: must differ from PII_ENCRYPTION_KEY")
  })

  it.each([
    [undefined, false],
    ["development", true],
    ["test", true],
    ["staging", false],
    ["production", false],
  ] as const)("treats NODE_ENV %p as local: %p", (nodeEnv, isLocal) => {
    expect(isLocalEnv({ NODE_ENV: nodeEnv })).toBe(isLocal)
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
