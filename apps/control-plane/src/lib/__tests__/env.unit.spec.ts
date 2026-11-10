import { EnvValidationError, parseEnv } from "../env"

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://postgres:pw@localhost:55432/qticaret_cp",
  ADMIN_CORS: "http://localhost:5174",
  AUTH_CORS: "http://localhost:5174",
  JWT_SECRET: "j".repeat(32),
  COOKIE_SECRET: "c".repeat(32),
  CP_HASH_KEY: "a".repeat(64),
  AUTH_MFA_ENCRYPTION_KEY: "b".repeat(64),
  CP_PANEL_URL: "http://localhost:5174",
}

const problems = (source: Record<string, string | undefined>): string => {
  try {
    parseEnv(source)
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError)
    return (error as Error).message
  }
  throw new Error("expected the environment to be refused")
}

describe("parseEnv", () => {
  it("accepts a local environment without Redis", () => {
    expect(parseEnv(valid)).toMatchObject({ NODE_ENV: "development", REDIS_URL: undefined })
  })

  it("names every missing variable, never a value", () => {
    const message = problems({ NODE_ENV: "development", JWT_SECRET: "short-secret-value" })

    for (const name of [
      "DATABASE_URL",
      "ADMIN_CORS",
      "COOKIE_SECRET",
      "CP_HASH_KEY",
      "AUTH_MFA_ENCRYPTION_KEY",
      "CP_PANEL_URL",
    ]) {
      expect(message).toContain(`${name}: is missing`)
    }
    expect(message).toContain("JWT_SECRET: must be at least 32 characters")
    expect(message).not.toContain("short-secret-value")
  })

  it("requires Redis outside development and test, an unset NODE_ENV included", () => {
    expect(problems({ ...valid, NODE_ENV: "production" })).toContain("REDIS_URL")
    expect(problems({ ...valid, NODE_ENV: undefined })).toContain("REDIS_URL")
    expect(
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        REDIS_URL: "redis://cache:6379",
        CP_PANEL_URL: "https://ust.example.com",
      }).REDIS_URL
    ).toBe("redis://cache:6379")
  })

  it("refuses one secret for both tokens and cookies", () => {
    expect(problems({ ...valid, COOKIE_SECRET: valid.JWT_SECRET })).toContain(
      "COOKIE_SECRET: must differ from JWT_SECRET"
    )
  })

  it("refuses a malformed hash key and a load test where it is live", () => {
    expect(problems({ ...valid, CP_HASH_KEY: "not-hex" })).toContain("CP_HASH_KEY")
    expect(
      problems({ ...valid, NODE_ENV: "production", REDIS_URL: "redis://r", LOAD_TEST: "on" })
    ).toContain("LOAD_TEST")
  })

  it("keeps 2FA on and Mailpit local, the panel on https once deployed (adr/0061 Ek C4)", () => {
    const live = { ...valid, NODE_ENV: "production", REDIS_URL: "redis://r" }

    expect(problems({ ...live, ADMIN_MFA: "off" })).toContain("ADMIN_MFA")
    expect(parseEnv({ ...valid, ADMIN_MFA: "off" }).ADMIN_MFA).toBe("off")
    expect(problems(live)).toContain("CP_PANEL_URL: must be https")
    expect(
      problems({
        ...live,
        CP_PANEL_URL: "https://ust.example.com",
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: "http://127.0.0.1:58025",
        EMAIL_FROM: "destek@example.com",
      })
    ).toContain("EMAIL_TRANSPORT")
    expect(problems({ ...valid, EMAIL_TRANSPORT: "mailpit", MAILPIT_URL: "http://m" })).toContain(
      "EMAIL_FROM"
    )
  })
})
