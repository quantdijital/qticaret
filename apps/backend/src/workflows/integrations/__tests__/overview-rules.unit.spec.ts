import type { CredentialStatus } from "../../../modules/integration-credentials/types"
import { accountRow, bankTransferRow, emailRow, feedsRow, googleRow } from "../overview-rules"

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
    expect(accountRow("shipping", status("aras", "unverified"))).toMatchObject({
      state: "attention",
      notes: [{ code: "unverified" }],
    })
  })

  it("notes PTT's account as never confirmed, not as something to fix", () => {
    // PTT answers a made-up account as it does a right one: "not verified" is all it gets
    expect(accountRow("shipping", status("ptt", "unverified", { test_mode: true }))).toEqual({
      id: "ptt",
      group: "shipping",
      state: "connected",
      notes: [{ code: "test_mode" }, { code: "unconfirmed" }],
      test: "account",
    })
    expect(accountRow("shipping", status("ptt", "rejected"))).toMatchObject({
      state: "attention",
      notes: [{ code: "rejected" }],
    })
  })

  it("says what Google still needs once the platform opens it: Search Console's site, Merchant Center", () => {
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
    // Not offered at all until the platform opens it (docs/06 principle 10)
    expect(google({ platform: false })).toBeNull()
    expect(google({ site: null, merchantId: null })).toMatchObject({
      state: "connected",
      notes: [{ code: "search_console_no_site" }, { code: "merchant_not_chosen" }],
    })
    expect(google({ searchConsoleGranted: false, lastSyncFailed: true })).toMatchObject({
      state: "attention",
      notes: [{ code: "search_console_not_granted" }, { code: "merchant_sync_failed" }],
    })
    expect(google({ account: status("google", "not_configured") })?.state).toBe("not_set_up")
  })

  it("reads the shop's own services: transfers, e-mail, feeds", () => {
    expect([bankTransferRow(true).state, bankTransferRow(false).state]).toEqual([
      "connected",
      "off",
    ])
    const sender = "bildirim@platform.example"
    const mail = { sending: true, ownDomain: true, sender, domain: null }
    // Nothing sends: the platform's, so the shop is told only that
    expect(emailRow({ ...mail, sending: false, sender: null })).toMatchObject({
      state: "off",
      notes: [{ code: "not_sending" }],
    })
    expect(emailRow({ ...mail, sender: null })).toMatchObject({ state: "off" })
    // A developer's local mailbox sends the shop's e-mail, but verifies no domain: none offered
    expect(emailRow({ ...mail, ownDomain: false })).toMatchObject({
      state: "connected",
      notes: [{ code: "sending", sender }],
    })
    expect(emailRow(mail)).toMatchObject({
      state: "connected",
      notes: [{ code: "platform_sender", sender }],
    })
    // Still sent from the platform's address while the shop's domain waits on its DNS
    expect(emailRow({ ...mail, domain: { status: "pending" } })).toMatchObject({
      state: "attention",
      notes: [{ code: "sending", sender }, { code: "domain_unverified" }],
    })
    const own = "bildirim@magaza.example.com"
    expect(emailRow({ ...mail, sender: own, domain: { status: "verified" } })).toMatchObject({
      state: "connected",
      notes: [{ code: "sending", sender: own }],
    })
    expect(feedsRow(true, false)).toMatchObject({
      state: "attention",
      notes: [{ code: "no_storefront" }],
    })
  })
})
