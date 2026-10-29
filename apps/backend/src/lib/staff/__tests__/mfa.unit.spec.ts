import { staffMfaPolicy } from "../mfa"

const KEY = "ab".repeat(32)

describe("staff 2FA policy (adr/0040 §2)", () => {
  it.each(["production", "staging", undefined] as const)(
    "requires it where the shop runs (%s), whatever ADMIN_MFA says",
    (env) => {
      expect(staffMfaPolicy({ NODE_ENV: env, AUTH_MFA_ENCRYPTION_KEY: KEY }, "off")).toBe(
        "required"
      )
    }
  )

  it("requires it locally once the key is set, unless turned off", () => {
    expect(
      staffMfaPolicy({ NODE_ENV: "development", AUTH_MFA_ENCRYPTION_KEY: KEY }, undefined)
    ).toBe("required")
    expect(staffMfaPolicy({ NODE_ENV: "test", AUTH_MFA_ENCRYPTION_KEY: KEY }, "off")).toBe("off")
  })

  it("leaves it off locally without a key: Medusa could keep no factor", () => {
    expect(
      staffMfaPolicy({ NODE_ENV: "development", AUTH_MFA_ENCRYPTION_KEY: undefined }, "on")
    ).toBe("off")
  })
})
