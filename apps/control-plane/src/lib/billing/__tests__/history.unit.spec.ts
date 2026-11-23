import { planDocumentSchema } from "@qticaret/types/control-plane"
import { contentHash, planContent, planDocumentOf } from "../../fleet/plan-content"
import { fullLimits } from "../../plans/limits"
import type { ChargeRecord } from "../../../modules/billing/types"
import { billingHistoryOf, historyRecordOf } from "../history"
import { subscriptionTerms } from "../terms"

const charge = (changes: Partial<ChargeRecord> = {}): ChargeRecord => ({
  id: "chg_01",
  subscription_id: "sub_01",
  tenant_id: "ten_a",
  period: "monthly",
  period_start: "2026-11-01",
  period_end: "2026-12-01",
  amount: 149_000,
  list_amount: 149_000,
  currency_code: "TRY",
  due_on: "2026-11-01",
  status: "paid",
  paid_on: "2026-11-03",
  method: "bank_transfer",
  reference: "EFT 2611-0042 Selin Aydın",
  settled_by: "user_01",
  settled_at: new Date("2026-11-03T09:00:00Z"),
  settle_reason: null,
  amount_reason: "indirim",
  invoice_number: null,
  invoice_ettn: null,
  invoice_pdf_url: null,
  created_at: new Date("2026-10-18T09:00:00Z"),
  ...changes,
})

describe("historyRecordOf (adr/0061 Ek C20)", () => {
  it("gives the shop its period, days, amount and status, never what staff wrote", () => {
    const record = historyRecordOf(charge())

    expect(record).toEqual({
      id: "chg_01",
      period: "monthly",
      period_start: "2026-11-01",
      period_end: "2026-12-01",
      due_on: "2026-11-01",
      amount: 149_000,
      currency: "TRY",
      status: "paid",
      paid_on: "2026-11-03",
      invoice_number: null,
      invoice_url: null,
    })
    const text = JSON.stringify(record)
    for (const secret of ["EFT", "Selin", "user_01", "indirim", "bank_transfer"]) {
      expect(text).not.toContain(secret)
    }
  })

  it("leaves a voided charge out, and a paid day off anything not paid", () => {
    expect(historyRecordOf(charge({ status: "void" }))).toBeNull()
    expect(historyRecordOf(charge({ status: "waived" }))?.paid_on).toBeNull()
    expect(historyRecordOf(charge({ status: "open", paid_on: null }))?.status).toBe("open")
  })

  it("keeps an https invoice link and drops any other", () => {
    expect(
      historyRecordOf(
        charge({ invoice_number: "QTC2026000001", invoice_pdf_url: "https://e.example/f/1.pdf" })
      )
    ).toMatchObject({ invoice_number: "QTC2026000001", invoice_url: "https://e.example/f/1.pdf" })
    for (const url of ["http://e.example/f.pdf", "javascript:alert(1)", "https://a:b@e.example/"]) {
      expect(historyRecordOf(charge({ invoice_pdf_url: url }))?.invoice_url).toBeNull()
    }
  })
})

describe("billingHistoryOf (adr/0061 Ek C20)", () => {
  function container(rows: ChargeRecord[]) {
    const asked: { tenantId: string; take: number }[] = []
    const billing = {
      historyOf: (tenantId: string, take: number) => {
        asked.push({ tenantId, take })
        return Promise.resolve(rows)
      },
    }
    return { container: { resolve: () => billing } as never, asked }
  }

  it("asks for the signer's shop only, at most 24, and keeps no other shop's row", async () => {
    const { container: scope, asked } = container([
      charge({ id: "chg_02", period_start: "2026-12-01" }),
      // A row of another shop never reaches the answer, whatever the query returned
      charge({ id: "chg_other", tenant_id: "ten_b" }),
      charge({ id: "chg_01" }),
      charge({ id: "chg_bad", due_on: "not a day" }),
    ])

    const history = await billingHistoryOf(scope, "ten_a")

    expect(asked).toEqual([{ tenantId: "ten_a", take: 24 }])
    expect(history.tenant_id).toBe("ten_a")
    expect(history.records.map((record) => record.id)).toEqual(["chg_02", "chg_01"])
  })

  it("answers an empty history for a shop with no charges", async () => {
    const { container: scope } = container([])
    expect(await billingHistoryOf(scope, "ten_a")).toEqual({ tenant_id: "ten_a", records: [] })
  })
})

describe("subscriptionTerms (adr/0061 Ek C20)", () => {
  const plan = { price: 199_000, period: "yearly" as const }

  it("is the package's price and period before a subscription, with no trial", () => {
    expect(subscriptionTerms(null, plan)).toEqual({
      period: "yearly",
      price: 199_000,
      trial_started_on: null,
      trial_ends_on: null,
    })
  })

  it("is the subscription's own copy, its trial from the day it started", () => {
    const sub = {
      price: 149_000,
      period: "monthly" as const,
      started_on: "2026-11-01",
      trial_ends_on: "2026-11-15",
    }
    expect(subscriptionTerms(sub, plan)).toEqual({
      period: "monthly",
      price: 149_000,
      trial_started_on: "2026-11-01",
      trial_ends_on: "2026-11-15",
    })
    expect(subscriptionTerms({ ...sub, trial_ends_on: null }, plan)).toMatchObject({
      trial_started_on: null,
      trial_ends_on: null,
    })
  })

  it("goes into a document the contract's strict schema accepts", () => {
    const content = planContent({
      tenantId: "ten_a",
      status: "active",
      packageCode: "standart",
      packageLimits: fullLimits({}),
      packageFeatures: {},
      limitOverrides: [],
      flagOverrides: [],
      billing: {
        status: "trialing",
        due_on: "2026-11-15",
        grace_ends_on: null,
        amount: 149_000,
        currency: "TRY",
        package_name: "Standart",
        payment_instruction: null,
        ...subscriptionTerms(
          {
            price: 149_000,
            period: "monthly",
            started_on: "2026-11-01",
            trial_ends_on: "2026-11-15",
          },
          plan
        ),
      },
      now: new Date("2026-11-05T09:00:00Z"),
      nodeEnv: "test",
    })
    const document = planDocumentOf(content, 1, new Date("2026-11-05T09:00:00Z"))

    expect(planDocumentSchema.parse(document).billing).toMatchObject({
      period: "monthly",
      price: 149_000,
      trial_started_on: "2026-11-01",
      trial_ends_on: "2026-11-15",
    })
    // The terms are part of the content: a change to them issues a new document
    const later = { ...content, billing: { ...content.billing, price: 159_000 } }
    expect(contentHash(later)).not.toBe(contentHash(content))
  })
})
