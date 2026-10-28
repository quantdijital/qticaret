import { startFakeNetgsm } from "@qticaret/testing"
import type { FakeNetgsm } from "@qticaret/testing"
import { createNetgsmIysApi, iysAccountOf, iysRecordOf } from "../netgsm-iys"
import type { IysAccount } from "../netgsm-iys"

describe("İYS through Netgsm (F10 M11)", () => {
  let fake: FakeNetgsm
  let account: IysAccount
  const api = () => createNetgsmIysApi({ baseUrl: fake.url })
  const granted = {
    channel: "sms" as const,
    status: "granted" as const,
    source: "checkout",
    // 21:05 UTC is past midnight in Türkiye
    changed_at: "2026-10-28T21:05:09Z",
  }

  beforeAll(async () => {
    fake = await startFakeNetgsm()
    account = {
      usercode: fake.account.usercode,
      password: fake.account.password,
      brandCode: fake.account.brandCode,
    }
  })

  afterAll(async () => {
    await fake.close()
  })

  beforeEach(() => {
    fake.iys.length = 0
  })

  it("reads the account only with a brand code of digits", () => {
    const secrets = { usercode: "u", password: "p" }

    expect(iysAccountOf({ settings: { iys_brand_code: "654321" }, secrets })).toEqual({
      usercode: "u",
      password: "p",
      brandCode: "654321",
    })
    expect(iysAccountOf({ settings: {}, secrets })).toBeNull()
    expect(iysAccountOf({ settings: { iys_brand_code: "MARKA" }, secrets })).toBeNull()
  })

  it("words a consent as İYS takes it, in Türkiye's time", () => {
    expect(iysRecordOf(granted, "+905321234567")).toEqual({
      type: "MESAJ",
      source: "HS_WEB",
      recipient: "+905321234567",
      status: "ONAY",
      consentDate: "2026-10-29 00:05:09",
      recipientType: "BIREYSEL",
    })
    expect(
      iysRecordOf({ ...granted, channel: "email", status: "revoked", source: "panel" }, "A@B.com")
    ).toMatchObject({
      type: "EPOSTA",
      recipient: "a@b.com",
      status: "RET",
      source: "HS_FIZIKSEL_ORTAM",
    })
    // What came from İYS goes back to it no more
    expect(iysRecordOf({ ...granted, source: "iys" }, "+905321234567")).toBeNull()
    expect(iysRecordOf(granted, "+902121234567")).toBeNull()
  })

  it("uploads a consent, and names İYS's refusal", async () => {
    const record = iysRecordOf(granted, "+905321234567")
    if (!record) {
      throw new Error("no record")
    }
    const sent = await api().add(account, record)
    fake.queueIys("70")
    const refused = await api()
      .add(account, record)
      .catch((error: unknown) => error)
    const wrongBrand = await api()
      .add({ ...account, brandCode: "1" }, record)
      .catch((error: unknown) => error)

    expect(sent.uid).toMatch(/^[0-9a-f-]{36}$/)
    expect(fake.iys).toEqual([record])
    expect(refused).toMatchObject({ providerCode: "iys_70", retryable: false })
    expect(wrongBrand).toMatchObject({ providerCode: "iys_40" })
  })
})
