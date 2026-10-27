import { describe, expect, it } from "vitest"
import type { PaytrAccount } from "@/features/settings/api/payments"
import {
  isPublicOrigin,
  paytrFormSchema,
  paytrFormValues,
  paytrNotificationUrl,
  paytrSaveBody,
  secretsRequired,
} from "@/features/settings/payments"

const connected: PaytrAccount = {
  provider: "paytr",
  state: "connected",
  settings: { merchant_id: "100001", test_mode: false },
  secrets: { merchant_key: true, merchant_salt: true },
  secrets_version: 1,
  verified_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
}

describe("PayTR settings form", () => {
  it("starts a new connection in test mode with empty secrets", () => {
    expect(paytrFormValues(undefined)).toEqual({
      merchant_id: "",
      merchant_key: "",
      merchant_salt: "",
      test_mode: true,
    })
    expect(paytrFormValues(connected)).toMatchObject({ merchant_id: "100001", test_mode: false })
  })

  it("asks for the secrets when none are stored, they cannot be read or the number changes", () => {
    expect(secretsRequired(undefined, "100001")).toBe(true)
    expect(secretsRequired({ ...connected, state: "unreadable" }, "100001")).toBe(true)
    expect(secretsRequired(connected, " 100001 ")).toBe(false)
    expect(secretsRequired(connected, "100002")).toBe(true)
  })

  it("leaves blank secrets out so the stored ones stay", () => {
    expect(
      paytrSaveBody({
        merchant_id: " 100001 ",
        merchant_key: "",
        merchant_salt: " s ",
        test_mode: true,
      })
    ).toEqual({
      settings: { merchant_id: "100001", test_mode: true },
      secrets: { merchant_salt: "s" },
    })
    expect(
      paytrSaveBody({
        merchant_id: "100001",
        merchant_key: " ",
        merchant_salt: "",
        test_mode: false,
      })
    ).toEqual({ settings: { merchant_id: "100001", test_mode: false } })
  })

  it("gives the notification address on the shop's own origin, public only over https", () => {
    expect(paytrNotificationUrl("https://magaza.example.com")).toBe(
      "https://magaza.example.com/hooks/paytr"
    )
    expect(isPublicOrigin("https://magaza.example.com")).toBe(true)
    expect(isPublicOrigin("http://magaza.example.com")).toBe(false)
    expect(isPublicOrigin("https://localhost:9000")).toBe(false)
    expect(isPublicOrigin("https://192.168.1.10")).toBe(false)
  })

  it("checks the form as the server does: digits, secrets when needed, PayTR's secret form", () => {
    const issues = (account: PaytrAccount | undefined, values: Record<string, unknown>) =>
      (
        paytrFormSchema(account).safeParse({
          merchant_id: "100001",
          merchant_key: "",
          merchant_salt: "",
          test_mode: true,
          ...values,
        }).error?.issues ?? []
      ).map((issue) => `${issue.path.join(".")}:${issue.message}`)

    expect(issues(connected, {})).toEqual([])
    expect(
      issues(undefined, {
        merchant_id: "12AB",
        merchant_key: "testkey-testkey",
        merchant_salt: "testsalt-testsalt",
      })
    ).toEqual(["merchant_id:settings.payments.paytr.merchantIdInvalid"])
    expect(issues(connected, { merchant_id: "100002" })).toEqual([
      "merchant_key:settings.payments.paytr.secretRequired",
      "merchant_salt:settings.payments.paytr.secretRequired",
    ])
    expect(issues(undefined, { merchant_key: "testkey-testkey", merchant_salt: "a b" })).toEqual([
      "merchant_salt:settings.payments.paytr.secretFormat",
    ])
  })
})
