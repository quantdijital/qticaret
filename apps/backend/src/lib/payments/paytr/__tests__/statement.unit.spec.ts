import { fakePaytrAccount, fakeSecret, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { turkishDay } from "../../../dashboard"
import { isProviderError } from "../../../errors"
import { kurus } from "../../../money"
import { createPaytrApi } from "../client"
import type { PaytrApi } from "../client"
import { readPaytrStatement } from "../statement"
import type { PaytrCredentials } from "../types"

const account = fakePaytrAccount()
const credentials: PaytrCredentials = { ...account, testMode: false }

const row = (over: Record<string, unknown> = {}) => ({
  islem_tipi: "S",
  net_tutar: "97.65",
  kesinti_tutari: "2.35",
  kesinti_orani: "2.35",
  islem_tutari: "100.00",
  odeme_tutari: "104.69",
  islem_tarihi: "28.10.2026",
  para_birimi: "TL",
  taksit: "3",
  siparis_no: "SIP001",
  odeme_tipi: "KART",
  ...over,
})

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return isProviderError(error) ? error.providerCode : String(error)
  }
  return "no error"
}

describe("PayTR's transaction statement", () => {
  it("reads the rows under a list, or one per key, in kuruş and Turkish days", () => {
    const listed = readPaytrStatement({ status: "success", data: [row()] })
    const numbered = readPaytrStatement({
      status: "success",
      "0": row(),
      "1": row({ islem_tipi: "I", islem_tutari: "40.5", odeme_tutari: "" }),
    })

    expect(listed).toEqual([
      {
        kind: "sale",
        reference: "SIP001",
        amount: kurus(10000),
        alternative: kurus(10469),
        day: "2026-10-28",
      },
    ])
    expect(numbered[1]).toEqual({
      kind: "refund",
      reference: "SIP001",
      amount: kurus(4050),
      alternative: null,
      day: "2026-10-28",
    })
  })

  it("is empty when PayTR found nothing, and refuses an error or a row it cannot read", () => {
    expect(readPaytrStatement({ status: "failed" })).toEqual([])
    expect(codeOf(() => readPaytrStatement({ status: "error", err_no: "002" }))).toBe("error_002")
    expect(
      codeOf(() => readPaytrStatement({ status: "success", "0": row({ islem_tutari: "1.000,5" }) }))
    ).toBe("invalid_response")
    expect(
      codeOf(() => readPaytrStatement({ status: "success", "0": row({ islem_tarihi: "dün" }) }))
    ).toBe("invalid_response")
  })

  describe("against the fake server", () => {
    let fake: FakePaytr
    let api: PaytrApi

    beforeEach(async () => {
      fake = await startFakePaytr(account)
      api = createPaytrApi({
        baseUrl: fake.url,
        timeoutMs: 500,
        retry: { baseDelayMs: 1 },
        sleep: () => Promise.resolve(),
      })
    })

    afterEach(async () => {
      await fake.close()
    })

    it("asks for three days, signed, and gets the day's sales and refunds", async () => {
      const today = turkishDay(new Date())
      fake.payments.set("SIP001", {
        merchantOid: "SIP001",
        paymentAmount: 12000,
        totalAmount: 12563,
        currency: "TL",
        testMode: false,
        installments: 3,
        status: "success",
        paidAt: Date.now(),
        notified: true,
        refunds: [{ amount: 2000, referenceNo: null }],
        formToken: "token",
        okUrl: "https://magaza.example.com/tamam",
        failUrl: "https://magaza.example.com/hata",
        maxInstallment: 0,
      })
      fake.refundLog.push({ merchantOid: "SIP001", amount: 2000, at: Date.now() })

      const rows = await api.statement(credentials, today, today)
      const sent = fake.requests.at(-1)?.fields

      expect(rows).toEqual([
        { kind: "sale", reference: "SIP001", amount: 12000, alternative: 12563, day: today },
        { kind: "refund", reference: "SIP001", amount: 2000, alternative: 2000, day: today },
      ])
      expect(sent).toMatchObject({ start_date: `${today} 00:00:00`, end_date: `${today} 23:59:59` })
      expect(Object.keys(sent ?? {})).not.toContain("merchant_key")
      expect(await api.statement(credentials, "2026-01-01", "2026-01-03")).toEqual([])
    })

    it("is refused under another account's key", async () => {
      const wrong = { ...credentials, merchantKey: fakeSecret() }

      await expect(api.statement(wrong, "2026-01-01", "2026-01-01")).rejects.toMatchObject({
        providerCode: "error_003",
      })
    })
  })
})
