import type { CredentialStatus } from "../../../modules/integration-credentials/types"
import {
  accountRow,
  accountingRow,
  bankTransferRow,
  emailRow,
  feedsRow,
  googleRow,
} from "../overview-rules"

const status = (
  provider: CredentialStatus["provider"],
  state: CredentialStatus["state"],
  settings: Record<string, unknown> | null = {}
): CredentialStatus => ({
  provider,
  state,
  settings: state === "not_configured" ? null : settings,
  secrets: {},
  secrets_version: 1,
  verified_at: null,
  updated_at: null,
  updated_by: null,
})

describe("integration overview rules", () => {
  it("reads a provider account's state, its test mode and whether it can be tested", () => {
    expect(accountRow("payments", status("paytr", "not_configured"))).toEqual({
      id: "paytr",
      group: "payments",
      state: "not_set_up",
      notes: [],
      test: null,
    })
    expect(accountRow("payments", status("iyzico", "connected", { test_mode: true }))).toEqual({
      id: "iyzico",
      group: "payments",
      state: "connected",
      notes: [{ code: "test_mode" }],
      test: "account",
    })
    expect(accountRow("shipping", status("aras", "rejected"))).toMatchObject({
      state: "attention",
      notes: [{ code: "rejected" }],
      test: "account",
    })
  })

  it("says what Google still needs: the platform, Search Console's site, Merchant Center", () => {
    const google = (facts: Partial<Parameters<typeof googleRow>[0]> = {}) =>
      googleRow({
        platform: true,
        account: status("google", "connected"),
        searchConsoleGranted: true,
        site: "sc-domain:ornek.com",
        merchantId: "123",
        lastSyncFailed: false,
        ...facts,
      })

    expect(google()).toMatchObject({ state: "connected", notes: [] })
    expect(google({ platform: false })).toMatchObject({
      state: "off",
      notes: [{ code: "platform_not_ready" }],
    })
    expect(google({ site: null, merchantId: null })).toMatchObject({
      state: "connected",
      notes: [{ code: "search_console_no_site" }, { code: "merchant_not_chosen" }],
    })
    expect(google({ searchConsoleGranted: false, lastSyncFailed: true })).toMatchObject({
      state: "attention",
      notes: [{ code: "search_console_not_granted" }, { code: "merchant_sync_failed" }],
    })
    expect(google({ account: status("google", "not_configured") }).state).toBe("not_set_up")
  })

  it("reads the shop's own services: transfers, e-mail, feeds, the accounting program", () => {
    expect([bankTransferRow(true).state, bankTransferRow(false).state]).toEqual([
      "connected",
      "off",
    ])
    expect(emailRow({ transport: null, domain: null })).toMatchObject({
      state: "off",
      notes: [{ code: "not_sending" }],
    })
    expect(emailRow({ transport: "resend", domain: null })).toMatchObject({
      state: "connected",
      notes: [{ code: "platform_sender" }],
    })
    expect(emailRow({ transport: "resend", domain: { status: "pending" } })).toMatchObject({
      state: "attention",
      notes: [{ code: "domain_unverified" }],
    })
    expect(feedsRow(true, false)).toMatchObject({
      state: "attention",
      notes: [{ code: "no_storefront" }],
    })
    expect(accountingRow(true, 3)).toMatchObject({
      state: "attention",
      notes: [{ code: "records_stopped", count: 3 }],
    })
    expect(accountingRow(false, 0).state).toBe("not_set_up")
  })
})
