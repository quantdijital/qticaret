import { describe, expect, it } from "vitest"
import {
  PLATFORM_FLAGS,
  isPlatformFlag,
  platformFlags,
} from "../../control-plane/platform-flags.js"
import { FEATURE_FLAG_KEY } from "../../control-plane/registry.js"

describe("platform flags (adr/0061 Ek C9)", () => {
  it("names each flag once, as a flag key", () => {
    const keys = PLATFORM_FLAGS.map((flag) => flag.key)

    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(key).toMatch(FEATURE_FLAG_KEY)
    }
  })

  it("keeps test-only flags to NODE_ENV=test, as the shop's registry does", () => {
    expect(platformFlags("test").map((flag) => flag.key)).toContain("test.platform_sample")
    for (const env of ["production", "development", undefined]) {
      expect(platformFlags(env).some((flag) => flag.testOnly === true)).toBe(false)
      expect(isPlatformFlag("test.platform_sample", env)).toBe(false)
    }
    expect(isPlatformFlag("test.platform_sample", "test")).toBe(true)
    expect(isPlatformFlag("catalog.addons", "test")).toBe(false)
    expect(isPlatformFlag("__proto__", "test")).toBe(false)
  })
})
