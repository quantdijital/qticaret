import { z } from "zod"
import {
  EnvValidationError,
  isBareOrigin,
  isLocalEnv,
  isLoopbackUrl,
  key256,
  nodeEnv,
  originList,
  parseEnvWith,
  secret,
} from ".."

const schema = z.object({
  NODE_ENV: nodeEnv,
  ORIGINS: originList,
  SESSION_SECRET: secret,
  KEY: key256.optional(),
})
const keys = Object.keys(schema.shape)

describe("parseEnvWith", () => {
  const valid = {
    NODE_ENV: "test",
    ORIGINS: "http://localhost:5173, https://shop.example.com",
    SESSION_SECRET: "s".repeat(32),
  }

  it("reads only the schema's keys and treats blanks as missing", () => {
    expect(parseEnvWith(keys, schema, { ...valid, KEY: "  ", OTHER: "x" })).toEqual({
      NODE_ENV: "test",
      ORIGINS: valid.ORIGINS,
      SESSION_SECRET: valid.SESSION_SECRET,
    })
  })

  it("names every problem without echoing a value", () => {
    const leaked = "short-secret-value"
    let message = ""
    try {
      parseEnvWith(keys, schema, { NODE_ENV: "prod", SESSION_SECRET: leaked, KEY: "zz" })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError)
      message = (error as Error).message
    }

    expect(message).toContain("  - ORIGINS: is missing")
    expect(message).toContain("  - SESSION_SECRET: must be at least 32 characters")
    expect(message).toContain("  - KEY: must be 64 hex characters (32 bytes)")
    expect(message).toContain("  - NODE_ENV:")
    expect(message).not.toContain(leaked)
  })
})

describe("env helpers", () => {
  it("counts only an explicit development or test environment as local", () => {
    expect(isLocalEnv({ NODE_ENV: "development" })).toBe(true)
    expect(isLocalEnv({ NODE_ENV: "test" })).toBe(true)
    expect(isLocalEnv({ NODE_ENV: "staging" })).toBe(false)
    expect(isLocalEnv({})).toBe(false)
  })

  it("tells a bare origin and a loopback address", () => {
    expect(isBareOrigin("https://shop.example.com")).toBe(true)
    expect(isBareOrigin("https://shop.example.com/path")).toBe(false)
    expect(isBareOrigin("https://user:pw@shop.example.com")).toBe(false)
    expect(isLoopbackUrl("http://127.0.0.1:4318")).toBe(true)
    expect(isLoopbackUrl("http://collector.internal:4318")).toBe(false)
  })
})
