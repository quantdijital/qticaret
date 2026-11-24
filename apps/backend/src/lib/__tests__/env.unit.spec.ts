import { randomBytes } from "node:crypto"
import {
  EnvValidationError,
  backendUrl,
  isLocalEnv,
  parseEnv,
  s3Settings,
  sharedFileOrigins,
  storefrontOrigin,
} from "../env"

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

// Made-up Turnstile keys in Cloudflare's shape, required once deployed (adr/0044 Ek 2026-11-24)
const turnstileEnv = {
  TURNSTILE_SITE_KEY: "0x4AAAAAAAmadeUpSiteKeyForEnvTests",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAmadeUpSecretForEnvTests",
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
        AUTH_MFA_ENCRYPTION_KEY: hexKey(),
        STOREFRONT_IP_SECRET: hexKey(),
        ...turnstileEnv,
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

  it("takes the storefront's origin bare, over TLS once deployed, localhost:8000 by default locally", () => {
    const deployed = {
      ...validEnv,
      ...s3Env,
      CREDENTIALS_ENCRYPTION_KEY: hexKey(),
      AUTH_MFA_ENCRYPTION_KEY: hexKey(),
      STOREFRONT_IP_SECRET: hexKey(),
      ...turnstileEnv,
      BACKEND_URL: "https://api.example.com",
      NODE_ENV: "production",
    }
    expect(errorOf({ ...validEnv, STOREFRONT_ORIGIN: "https://vitrin.example.com/api" })).toContain(
      "STOREFRONT_ORIGIN: must be an origin"
    )
    expect(errorOf({ ...deployed, STOREFRONT_ORIGIN: "http://vitrin.example.com" })).toContain(
      "STOREFRONT_ORIGIN: must be https in production and staging"
    )
    expect(
      storefrontOrigin(parseEnv({ ...deployed, STOREFRONT_ORIGIN: "https://vitrin.example.com/" }))
    ).toBe("https://vitrin.example.com")
    expect(storefrontOrigin({ STOREFRONT_ORIGIN: undefined, NODE_ENV: "production" })).toBeNull()
    expect(storefrontOrigin({ STOREFRONT_ORIGIN: undefined, NODE_ENV: "development" })).toBe(
      "http://localhost:8000"
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

  it("names the page origins a deployed shop's files share (an uploaded SVG would run there)", () => {
    const deployed = { ...s3Env, NODE_ENV: "production" as const }
    expect(
      sharedFileOrigins({
        ...deployed,
        BACKEND_URL: "https://magaza.example.com",
        STOREFRONT_ORIGIN: "https://www.magaza.example.com",
      })
    ).toEqual([])
    expect(
      sharedFileOrigins({
        ...deployed,
        S3_FILE_URL: "https://magaza.example.com/files",
        BACKEND_URL: "https://magaza.example.com",
      })
    ).toEqual(["backend"])
    expect(
      sharedFileOrigins({
        ...deployed,
        S3_FILE_URL: "https://www.magaza.example.com/files",
        STOREFRONT_ORIGIN: "https://www.magaza.example.com",
      })
    ).toEqual(["storefront"])
    // A developer's machine and the tests: quiet
    expect(
      sharedFileOrigins({
        ...s3Env,
        NODE_ENV: "development",
        S3_FILE_URL: "http://localhost:9000/files",
        BACKEND_URL: "http://localhost:9000",
      })
    ).toEqual([])
  })

  it.each(["production", "staging"])(
    "requires the provider account key in %s (adr/0027)",
    (env) => {
      expect(errorOf({ ...validEnv, ...s3Env, NODE_ENV: env })).toContain(
        "CREDENTIALS_ENCRYPTION_KEYS: is required in production and staging (or CREDENTIALS_ENCRYPTION_KEY, one key)"
      )
      // Either form is enough (adr/0061 Ek C17)
      for (const keys of [
        { CREDENTIALS_ENCRYPTION_KEY: hexKey() },
        { CREDENTIALS_ENCRYPTION_KEYS: hexKey() },
      ]) {
        expect(errorOf({ ...validEnv, ...s3Env, ...keys, NODE_ENV: env })).not.toContain(
          "CREDENTIALS_ENCRYPTION"
        )
      }
      expect(parseEnv(validEnv).CREDENTIALS_ENCRYPTION_KEY).toBeUndefined()
      expect(parseEnv(validEnv).CREDENTIALS_ENCRYPTION_KEYS).toBeUndefined()
    }
  )

  it("reads a list of provider account keys, newest first, strictly (adr/0061 Ek C17)", () => {
    const [newKey, oldKey] = [hexKey(), hexKey()]
    expect(
      parseEnv({ ...validEnv, CREDENTIALS_ENCRYPTION_KEYS: `${newKey}, ${oldKey.toUpperCase()}` })
        .CREDENTIALS_ENCRYPTION_KEYS
    ).toBe(`${newKey}, ${oldKey.toUpperCase()}`)

    const problems: [string, string][] = [
      [`${newKey},,${oldKey}`, "must list keys separated by single commas, with no empty entry"],
      [`${newKey},`, "must list keys separated by single commas, with no empty entry"],
      [`${newKey},abc`, "must list keys of 64 hex characters (32 bytes) each"],
      [`${newKey}:${oldKey}`, "must list keys of 64 hex characters (32 bytes) each"],
      [`${newKey},${newKey.toUpperCase()}`, "must not list the same key twice"],
      [Array.from({ length: 6 }, hexKey).join(","), "must list at most 5 keys"],
    ]
    for (const [value, message] of problems) {
      const error = errorOf({ ...validEnv, CREDENTIALS_ENCRYPTION_KEYS: value })
      expect(error).toContain(`CREDENTIALS_ENCRYPTION_KEYS: ${message}`)
      // The message names the variable, never a value
      expect(error).not.toContain(newKey)
    }
  })

  it("takes the single key beside the list only when the list holds it", () => {
    const [newKey, oldKey] = [hexKey(), hexKey()]
    expect(
      parseEnv({
        ...validEnv,
        CREDENTIALS_ENCRYPTION_KEYS: `${newKey},${oldKey}`,
        CREDENTIALS_ENCRYPTION_KEY: oldKey.toUpperCase(),
      }).CREDENTIALS_ENCRYPTION_KEY
    ).toBe(oldKey.toUpperCase())
    // Left out of the list it would silently stop opening what it sealed
    const error = errorOf({
      ...validEnv,
      CREDENTIALS_ENCRYPTION_KEYS: newKey,
      CREDENTIALS_ENCRYPTION_KEY: oldKey,
    })
    expect(error).toContain(
      "CREDENTIALS_ENCRYPTION_KEY: must be one of CREDENTIALS_ENCRYPTION_KEYS when both are set"
    )
    expect(error).not.toContain(oldKey)
  })

  it("refuses a secret reused as another key, naming variables only (adr/0061 Ek C19 I4)", () => {
    const [shared, list] = [hexKey(), hexKey()]
    const cases: [Record<string, string>, string][] = [
      [
        { AUTH_MFA_ENCRYPTION_KEY: validEnv.PII_ENCRYPTION_KEY },
        "AUTH_MFA_ENCRYPTION_KEY: must differ from PII_ENCRYPTION_KEY",
      ],
      [{ COOKIE_SECRET: jwtSecret }, "COOKIE_SECRET: must differ from JWT_SECRET"],
      [
        { JWT_SECRET: validEnv.PII_HASH_KEY.toUpperCase() },
        "JWT_SECRET: must differ from PII_HASH_KEY",
      ],
      [
        { CREDENTIALS_ENCRYPTION_KEYS: `${list},${shared}`, STOREFRONT_IP_SECRET: shared },
        "STOREFRONT_IP_SECRET: must differ from CREDENTIALS_ENCRYPTION_KEYS",
      ],
      [
        { CREDENTIALS_ENCRYPTION_KEY: shared, AUTH_MFA_ENCRYPTION_KEY: shared },
        "AUTH_MFA_ENCRYPTION_KEY: must differ from CREDENTIALS_ENCRYPTION_KEY",
      ],
      [
        { AUTH_MFA_ENCRYPTION_KEY: shared, STOREFRONT_IP_SECRET: shared },
        "STOREFRONT_IP_SECRET: must differ from AUTH_MFA_ENCRYPTION_KEY",
      ],
    ]
    for (const [changes, message] of cases) {
      const error = errorOf({ ...validEnv, ...changes })
      expect(error).toContain(message)
      for (const value of Object.values(changes)) {
        expect(error.toLowerCase()).not.toContain(value.toLowerCase())
      }
    }
    // Each its own, or unset: accepted
    expect(() =>
      parseEnv({
        ...validEnv,
        AUTH_MFA_ENCRYPTION_KEY: hexKey(),
        STOREFRONT_IP_SECRET: hexKey(),
        CREDENTIALS_ENCRYPTION_KEYS: list,
      })
    ).not.toThrow()
  })

  it.each(["production", "staging"])("requires the staff 2FA key in %s (adr/0040)", (env) => {
    expect(errorOf({ ...validEnv, NODE_ENV: env })).toContain(
      "AUTH_MFA_ENCRYPTION_KEY: is required in production and staging"
    )
    expect(errorOf({ ...validEnv, AUTH_MFA_ENCRYPTION_KEY: "short" })).toContain(
      "AUTH_MFA_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)"
    )
    expect(parseEnv(validEnv).AUTH_MFA_ENCRYPTION_KEY).toBeUndefined()
  })

  it.each(["production", "staging"])(
    "requires the storefront's address secret in %s (adr/0076 Ek D5)",
    (env) => {
      expect(errorOf({ ...validEnv, NODE_ENV: env })).toContain(
        "STOREFRONT_IP_SECRET: is required in production and staging"
      )
      expect(parseEnv(validEnv).STOREFRONT_IP_SECRET).toBeUndefined()
    }
  )

  it("keeps the provider account key apart from the PII keys", () => {
    expect(
      errorOf({ ...validEnv, CREDENTIALS_ENCRYPTION_KEY: validEnv.PII_HASH_KEY.toUpperCase() })
    ).toContain("CREDENTIALS_ENCRYPTION_KEY: must differ from the PII keys")
    expect(errorOf({ ...validEnv, CREDENTIALS_ENCRYPTION_KEY: "ab" })).toContain(
      "CREDENTIALS_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)"
    )
    expect(
      errorOf({
        ...validEnv,
        CREDENTIALS_ENCRYPTION_KEYS: `${hexKey()},${validEnv.PII_ENCRYPTION_KEY}`,
      })
    ).toContain("CREDENTIALS_ENCRYPTION_KEYS: must differ from the PII keys")
  })

  it("lets a fake iyzico address on a developer's machine only", () => {
    const fake = { IYZICO_BASE_URL: "http://127.0.0.1:4011" }

    expect(parseEnv({ ...validEnv, ...fake, NODE_ENV: "test" }).IYZICO_BASE_URL).toBe(
      fake.IYZICO_BASE_URL
    )
    // An unset NODE_ENV counts as live (docs/04): the CLI needs NODE_ENV=development
    expect(errorOf({ ...validEnv, ...fake })).toContain(
      "IYZICO_BASE_URL: is allowed on development and test only"
    )
    expect(
      errorOf({
        ...validEnv,
        ...s3Env,
        ...fake,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        AUTH_MFA_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "staging",
      })
    ).toContain("IYZICO_BASE_URL: is allowed on development and test only")
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
        AUTH_MFA_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "production",
      })
    ).toContain("GELIVER_BASE_URL: is allowed on development and test only")
  })

  it("sends e-mail through Mailpit on a developer's machine only, and through Resend with its key", () => {
    const mailpit = {
      EMAIL_TRANSPORT: "mailpit",
      MAILPIT_URL: "http://127.0.0.1:58025",
      EMAIL_FROM: "bildirim@magaza.test",
    }
    const deployed = {
      ...validEnv,
      ...s3Env,
      CREDENTIALS_ENCRYPTION_KEY: hexKey(),
      AUTH_MFA_ENCRYPTION_KEY: hexKey(),
    }

    expect(parseEnv({ ...validEnv, ...mailpit, NODE_ENV: "test" }).EMAIL_TRANSPORT).toBe("mailpit")
    expect(errorOf({ ...deployed, ...mailpit, NODE_ENV: "production" })).toContain(
      "MAILPIT_URL: is allowed on development and test only"
    )
    expect(
      errorOf({ ...validEnv, EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a@b.example" })
    ).toContain("RESEND_API_KEY: is required for resend")
    expect(errorOf({ ...validEnv, EMAIL_TRANSPORT: "resend" })).toContain(
      "EMAIL_FROM: is required with EMAIL_TRANSPORT"
    )
    // A live shop hears of its bounces, or keeps mailing dead addresses
    const resend = {
      EMAIL_TRANSPORT: "resend",
      EMAIL_FROM: "bildirim@magaza.example",
      RESEND_API_KEY: `re_${hexKey().slice(0, 20)}`,
      BACKEND_URL: "https://api.magaza.example",
    }
    expect(errorOf({ ...deployed, ...resend, NODE_ENV: "production" })).toContain(
      "RESEND_WEBHOOK_SECRET: is required for resend in production and staging"
    )
    expect(parseEnv({ ...validEnv, ...resend, NODE_ENV: "test" }).EMAIL_TRANSPORT).toBe("resend")
  })

  it("refuses the load test mode where a shop is live", () => {
    const load = { LOAD_TEST: "on" }
    expect(parseEnv({ ...validEnv, ...load, NODE_ENV: "development" }).LOAD_TEST).toBe("on")
    expect(errorOf({ ...validEnv, ...load, NODE_ENV: "production" })).toContain(
      "LOAD_TEST: is allowed on development, test and staging only"
    )
    // An unset NODE_ENV is treated as live
    expect(errorOf({ ...validEnv, ...load })).toContain("LOAD_TEST")
  })

  it("sends traces over TLS once deployed, but to a collector on this machine", () => {
    const deployed = {
      ...validEnv,
      ...s3Env,
      CREDENTIALS_ENCRYPTION_KEY: hexKey(),
      AUTH_MFA_ENCRYPTION_KEY: hexKey(),
      NODE_ENV: "production",
    }
    expect(
      errorOf({
        ...deployed,
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://iz.example.com/v1/traces",
      })
    ).toContain("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: must be https")
    expect(
      errorOf({ ...deployed, OTEL_EXPORTER_OTLP_ENDPOINT: "http://iz.example.com" })
    ).toContain("OTEL_EXPORTER_OTLP_ENDPOINT: must be https")
    expect(
      parseEnv({ ...validEnv, OTEL_EXPORTER_OTLP_ENDPOINT: "http://iz.example.com" })
        .OTEL_EXPORTER_OTLP_ENDPOINT
    ).toBe("http://iz.example.com")
  })

  it("reads a GlitchTip DSN and an OTLP collector, and refuses a DSN it cannot use", () => {
    const env = parseEnv({
      ...validEnv,
      ERROR_TRACKING_DSN: "https://abc123@hata.example.com/7",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://iz.example.com",
    })
    expect(env.ERROR_TRACKING_DSN).toBe("https://abc123@hata.example.com/7")
    expect(errorOf({ ...validEnv, ERROR_TRACKING_DSN: "https://hata.example.com/7" })).toContain(
      "ERROR_TRACKING_DSN"
    )
    expect(errorOf({ ...validEnv, ERROR_TRACKING_DSN: "http://abc@hata.example.com/7" })).toContain(
      "ERROR_TRACKING_DSN"
    )
  })

  it("lets a fake PayTR address on a developer's machine only", () => {
    const fake = { PAYTR_BASE_URL: "http://127.0.0.1:4010" }

    expect(parseEnv({ ...validEnv, ...fake, NODE_ENV: "test" }).PAYTR_BASE_URL).toBe(
      fake.PAYTR_BASE_URL
    )
    expect(errorOf({ ...validEnv, ...fake })).toContain(
      "PAYTR_BASE_URL: is allowed on development and test only"
    )
    expect(
      errorOf({
        ...validEnv,
        ...s3Env,
        ...fake,
        CREDENTIALS_ENCRYPTION_KEY: hexKey(),
        AUTH_MFA_ENCRYPTION_KEY: hexKey(),
        NODE_ENV: "production",
      })
    ).toContain("PAYTR_BASE_URL: is allowed on development and test only")
  })

  it.each([
    "PAYTR_BASE_URL",
    "IYZICO_BASE_URL",
    "GELIVER_BASE_URL",
    "ARAS_BASE_URL",
    "YURTICI_BASE_URL",
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
  ])("refuses a fake %s with NODE_ENV unset, which counts as live", (name) => {
    const fake = { [name]: "http://127.0.0.1:9100" }

    expect(errorOf({ ...validEnv, ...fake })).toContain(
      `${name}: is allowed on development and test only`
    )
    expect(errorOf({ ...validEnv, ...fake, NODE_ENV: "staging" })).toContain(name)
    expect(
      parseEnv({ ...validEnv, ...fake, NODE_ENV: "development" })[name as "GA4_BASE_URL"]
    ).toBe(fake[name])
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
