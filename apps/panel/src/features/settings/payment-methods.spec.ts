import { describe, expect, it } from "vitest"
import { inTestMode, isAccountMethod, isConnectable } from "@/features/settings/payment-methods"

describe("payment methods", () => {
  it("opens a page only for a method that is built", () => {
    expect(isConnectable("paytr")).toBe(true)
    expect(isConnectable("iyzico")).toBe(true)
    expect(isConnectable("bank_transfer")).toBe(true)
    expect(isConnectable("cash_on_delivery")).toBe(false)
    expect(isConnectable("paytr2")).toBe(false)
  })

  it("tells a provider account from the shop's own settings", () => {
    expect(isAccountMethod("paytr")).toBe(true)
    expect(isAccountMethod("bank_transfer")).toBe(false)
  })

  it("reads test mode from any provider's settings", () => {
    const account = (settings: Record<string, unknown> | null) => ({
      provider: "paytr",
      state: "connected" as const,
      settings,
      secrets: {},
      secrets_version: 1,
      verified_at: null,
      updated_at: null,
    })
    expect(inTestMode(account({ test_mode: true }))).toBe(true)
    expect(inTestMode(account({ test_mode: false }))).toBe(false)
    expect(inTestMode(account(null))).toBe(false)
    expect(inTestMode(undefined)).toBe(false)
  })
})
