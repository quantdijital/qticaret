import { EnvValidationError, parseEnv } from "../env"

// A public age recipient whose identity was thrown away when it was made
const RECIPIENT = "age13m66sfqm8l0gwzka9arej9334jfutmy3ael4cjkdukdzw8uedseq6s0qv8"

const valid = {
  CP_ESCROW_RECIPIENTS: RECIPIENT,
  NODE_ENV: "development",
  DATABASE_URL: "postgres://postgres:pw@localhost:55432/qticaret_cp",
  ADMIN_CORS: "http://localhost:5174",
  AUTH_CORS: "http://localhost:5174",
  JWT_SECRET: "j".repeat(32),
  COOKIE_SECRET: "c".repeat(32),
  CP_HASH_KEY: "a".repeat(64),
  AUTH_MFA_ENCRYPTION_KEY: "b".repeat(64),
  CP_PANEL_URL: "http://localhost:5174",
  CP_MASTER_KEY: "d".repeat(64),
  PLATFORM_DOMAIN: "localhost",
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
        PLATFORM_DOMAIN: "quantticaret.com",
      }).REDIS_URL
    ).toBe("redis://cache:6379")
  })

  it("refuses one secret for both tokens and cookies", () => {
    expect(problems({ ...valid, COOKIE_SECRET: valid.JWT_SECRET })).toContain(
      "COOKIE_SECRET: must differ from JWT_SECRET"
    )
  })

  it("refuses one key for two jobs, in any case (Ek C4, L8)", () => {
    expect(
      problems({ ...valid, AUTH_MFA_ENCRYPTION_KEY: valid.CP_HASH_KEY.toUpperCase() })
    ).toContain("AUTH_MFA_ENCRYPTION_KEY: must differ from CP_HASH_KEY")
    expect(problems({ ...valid, JWT_SECRET: valid.CP_HASH_KEY })).toContain(
      "CP_HASH_KEY: must differ from JWT_SECRET"
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

  it("takes public age recipients for the escrow, never an identity (adr/0061 §4.3, C8)", () => {
    const second = "age1tgyuvdlmpejqsdf847hevurz9szk7vf3j7ytfyqecgzvphvu2d8qrtaxl6"
    // An identity's shape, made up here: refused for its prefix, never echoed
    const identity = `AGE-SECRET-KEY-1${"Q".repeat(58)}`

    expect(
      parseEnv({ ...valid, CP_ESCROW_RECIPIENTS: `${RECIPIENT}, ${second}` }).CP_ESCROW_RECIPIENTS
    ).toContain(second)
    expect(problems({ ...valid, CP_ESCROW_RECIPIENTS: undefined })).toContain(
      "CP_ESCROW_RECIPIENTS: is missing"
    )
    const refused = problems({ ...valid, CP_ESCROW_RECIPIENTS: identity })
    expect(refused).toContain("CP_ESCROW_RECIPIENTS: must list public recipients only")
    expect(refused).not.toContain(identity)
    expect(problems({ ...valid, CP_ESCROW_RECIPIENTS: `${RECIPIENT.slice(0, -1)}x` })).toContain(
      "CP_ESCROW_RECIPIENTS: lists an invalid age recipient"
    )
    expect(problems({ ...valid, CP_ESCROW_RECIPIENTS: "ssh-ed25519 AAAA" })).toContain(
      "CP_ESCROW_RECIPIENTS"
    )
  })

  it("takes a list of master keys, each its own, and a platform domain (adr/0061 §4.1, C7)", () => {
    expect(
      parseEnv({ ...valid, CP_MASTER_KEY: `${"e".repeat(64)}, ${"d".repeat(64)}` })
    ).toBeTruthy()
    expect(problems({ ...valid, CP_MASTER_KEY: "short" })).toContain("CP_MASTER_KEY")
    expect(problems({ ...valid, CP_MASTER_KEY: valid.CP_HASH_KEY })).toContain(
      "CP_MASTER_KEY: must differ from CP_HASH_KEY"
    )
    expect(problems({ ...valid, CP_MASTER_KEY: `${"e".repeat(64)},${"E".repeat(64)}` })).toContain(
      "CP_MASTER_KEY: lists the same key twice"
    )
    expect(problems({ ...valid, PLATFORM_DOMAIN: "https://x.com" })).toContain("PLATFORM_DOMAIN")
    expect(
      problems({
        ...valid,
        NODE_ENV: "production",
        REDIS_URL: "redis://r",
        CP_PANEL_URL: "https://ust.example.com",
      })
    ).toContain("PLATFORM_DOMAIN: must have two labels")
  })

  it.each([
    ["quantticaret", "two labels"],
    ["quant.local", "local or reserved"],
    ["magaza.test", "local or reserved"],
    ["cp.internal", "local or reserved"],
    ["shop.example", "local or reserved"],
    ["x.invalid", "local or reserved"],
    ["a.localhost", "local or reserved"],
    ["10.0.0.1", "alphabetic top-level"],
    ["quant.t1", "alphabetic top-level"],
  ])("refuses %s as the platform's domain once deployed (review L2)", (domain, why) => {
    const live = {
      ...valid,
      NODE_ENV: "production",
      REDIS_URL: "redis://r",
      CP_PANEL_URL: "https://ust.example.com",
      PLATFORM_DOMAIN: domain,
    }

    expect(problems(live)).toContain(why)
  })

  it("takes a public domain once deployed, and localhost on this machine", () => {
    const live = {
      ...valid,
      NODE_ENV: "production",
      REDIS_URL: "redis://r",
      CP_PANEL_URL: "https://ust.example.com",
    }

    expect(parseEnv({ ...live, PLATFORM_DOMAIN: "quantticaret.com" }).PLATFORM_DOMAIN).toBe(
      "quantticaret.com"
    )
    expect(parseEnv({ ...live, PLATFORM_DOMAIN: "magaza.quantticaret.com.tr" })).toBeTruthy()
    expect(parseEnv({ ...valid, PLATFORM_DOMAIN: "localhost" })).toBeTruthy()
  })

  it("takes where custom domains point, refusing a URL or a name for an address (F16.7)", () => {
    expect(
      parseEnv({
        ...valid,
        CP_DOMAIN_CNAME_TARGET: "edge.quantticaret.com",
        CP_DOMAIN_A_TARGETS: "203.0.113.7, 2001:db8::1",
      })
    ).toMatchObject({ CP_DOMAIN_CNAME_TARGET: "edge.quantticaret.com" })
    expect(problems({ ...valid, CP_DOMAIN_CNAME_TARGET: "https://edge.example.com" })).toContain(
      "CP_DOMAIN_CNAME_TARGET"
    )
    expect(problems({ ...valid, CP_DOMAIN_A_TARGETS: "edge.example.com" })).toContain(
      "CP_DOMAIN_A_TARGETS"
    )
    // The tests' fake DNS is refused anywhere else
    expect(problems({ ...valid, CP_DNS_FAKE: "{}" })).toContain("CP_DNS_FAKE")
    expect(parseEnv({ ...valid, NODE_ENV: "test", CP_DNS_FAKE: "{}" })).toBeTruthy()
  })

  it("keeps the local provisioner to this machine and the fake one to tests (Ek C10)", () => {
    const admin = "postgres://postgres:pw@localhost:55432/postgres"
    expect(
      parseEnv({ ...valid, CP_PROVISIONER: "local", CP_LOCAL_PG_ADMIN_URL: admin })
    ).toMatchObject({ CP_PROVISIONER: "local" })
    expect(problems({ ...valid, CP_PROVISIONER: "local" })).toContain(
      "CP_LOCAL_PG_ADMIN_URL: is required with CP_PROVISIONER=local"
    )
    const deployed = problems({
      ...valid,
      NODE_ENV: "production",
      CP_PROVISIONER: "local",
      CP_LOCAL_PG_ADMIN_URL: admin,
    })
    expect(deployed).toContain("CP_PROVISIONER: local is allowed on development only")
    expect(deployed).toContain("CP_LOCAL_PG_ADMIN_URL: is allowed on development and test only")
    expect(deployed).not.toContain(":pw@")
    expect(
      problems({
        ...valid,
        CP_LOCAL_PG_ADMIN_URL: "postgres://postgres:pw@db.example.com/postgres",
      })
    ).toContain("CP_LOCAL_PG_ADMIN_URL: must point at a database on this machine")
    expect(problems({ ...valid, CP_PROVISIONER: "fake" })).toContain(
      "CP_PROVISIONER: fake is allowed in tests only"
    )
    expect(problems({ ...valid, CP_PROVISIONER: "docker" })).toContain("not available yet")
  })

  it("lets a local shop reach a second copy on this machine only (Ek C13)", () => {
    expect(
      parseEnv({ ...valid, CP_LOCAL_CONTROL_PLANE_URL: "http://localhost:9110" })
    ).toMatchObject({ CP_LOCAL_CONTROL_PLANE_URL: "http://localhost:9110" })
    for (const url of [
      "http://cp.example.com:9110",
      "https://localhost:9110",
      "http://localhost:9110/tenant-api",
      "http://user:pw@localhost:9110",
    ]) {
      expect(problems({ ...valid, CP_LOCAL_CONTROL_PLANE_URL: url })).toContain(
        "CP_LOCAL_CONTROL_PLANE_URL"
      )
    }
    expect(
      problems({
        ...valid,
        NODE_ENV: "production",
        CP_LOCAL_CONTROL_PLANE_URL: "http://localhost:9110",
      })
    ).toContain("CP_LOCAL_CONTROL_PLANE_URL: is allowed on development and test only")
  })
})
