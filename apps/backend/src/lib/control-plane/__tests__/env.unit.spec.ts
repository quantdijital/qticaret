import { randomBytes } from "node:crypto"
import { generateEd25519KeyPair } from "@qticaret/server-kit"
import { EnvValidationError, parseEnv } from "../../env"
import { assertControlPlaneConfigured } from "../env"
import { pullDue, PULL_EVERY_MS } from "../../../jobs/control-plane-pull"

const hexKey = () => randomBytes(32).toString("hex")

// Test-only values, generated per run (docs/04)
const base = {
  DATABASE_URL: "postgres://postgres:pw@localhost:55432/qticaret",
  REDIS_URL: "redis://localhost:56379",
  STORE_CORS: "http://localhost:8000",
  ADMIN_CORS: "http://localhost:9000",
  AUTH_CORS: "http://localhost:9000",
  JWT_SECRET: hexKey(),
  COOKIE_SECRET: hexKey(),
  PII_ENCRYPTION_KEY: hexKey(),
  PII_HASH_KEY: hexKey(),
}

const cp = generateEd25519KeyPair()
const shop = generateEd25519KeyPair()
const managed = {
  CONTROL_PLANE_URL: "http://control-plane:9100",
  CONTROL_PLANE_PUBLIC_KEYS: cp.publicKey,
  TENANT_ID: "ten_01JCP0TEST0000000000000000",
  TENANT_SIGNING_KEY: shop.seed,
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
  return ""
}

describe("the control plane's variables (adr/0061 §3.3, Ek C9)", () => {
  it("are optional on a developer's machine and in tests: unmanaged", () => {
    expect(errorOf({ ...base, NODE_ENV: "development" })).toBe("")
    expect(errorOf({ ...base, ...managed, NODE_ENV: "test" })).toBe("")
  })

  it.each(["production", "staging"])("are all required at boot in %s", (nodeEnv) => {
    let message = ""
    try {
      assertControlPlaneConfigured({ NODE_ENV: nodeEnv, TENANT_ID: managed.TENANT_ID })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError)
      message = (error as Error).message
    }
    for (const name of ["CONTROL_PLANE_URL", "CONTROL_PLANE_PUBLIC_KEYS", "TENANT_SIGNING_KEY"]) {
      expect(message).toContain(`${name}: is required in production and staging`)
    }
    expect(message).not.toContain("TENANT_ID")
    expect(() => {
      assertControlPlaneConfigured({ ...managed, NODE_ENV: nodeEnv })
    }).not.toThrow()
    expect(() => {
      assertControlPlaneConfigured({ NODE_ENV: "development" })
    }).not.toThrow()
  })

  it("asks the shop's id with the keys, and the pull's two halves together", () => {
    const keysOnly = { CONTROL_PLANE_PUBLIC_KEYS: cp.publicKey }
    expect(errorOf({ ...base, ...keysOnly, NODE_ENV: "development" })).toContain(
      "TENANT_ID: is required with CONTROL_PLANE_PUBLIC_KEYS"
    )
    expect(
      errorOf({ ...base, ...managed, TENANT_SIGNING_KEY: undefined, NODE_ENV: "development" })
    ).toContain("TENANT_SIGNING_KEY: is required with the other")
  })

  it("names a bad value's variable, never the value", () => {
    const message = errorOf({
      ...base,
      ...managed,
      TENANT_SIGNING_KEY: "not-a-key",
      CONTROL_PLANE_PUBLIC_KEYS: `${cp.publicKey},nope`,
      TENANT_ID: "shop-1",
      NODE_ENV: "development",
    })

    expect(message).toContain("TENANT_SIGNING_KEY: must be a 32-byte key in base64url")
    expect(message).toContain("CONTROL_PLANE_PUBLIC_KEYS: must list 32-byte public keys")
    expect(message).toContain("TENANT_ID:")
    expect(message).not.toContain("not-a-key")
    expect(message).not.toContain(cp.publicKey)
    expect(message).not.toContain("shop-1")
  })

  it("lets http reach the control plane once deployed only on the internal network", () => {
    const deployed = { ...base, ...managed, NODE_ENV: "production" }
    expect(errorOf(deployed)).not.toContain("CONTROL_PLANE_URL")
    expect(errorOf({ ...deployed, CONTROL_PLANE_URL: "http://cp.example.com" })).toContain(
      "CONTROL_PLANE_URL: must be https"
    )
    expect(errorOf({ ...deployed, CONTROL_PLANE_URL: "https://cp.example.com" })).not.toContain(
      "CONTROL_PLANE_URL"
    )
    expect(errorOf({ ...deployed, CONTROL_PLANE_URL: "https://u:p@cp.example.com" })).toContain(
      "CONTROL_PLANE_URL: must be a base URL"
    )
  })
})

describe("the pull's rhythm (adr/0061 §3.2)", () => {
  it("pulls on the first run after boot, then every 15 minutes", () => {
    expect(pullDue(null, 0)).toBe(true)
    expect(pullDue(0, 60_000)).toBe(false)
    expect(pullDue(0, PULL_EVERY_MS)).toBe(true)
  })
})
