import { describe, expect, it } from "vitest"
import {
  BILLING_HISTORY_LIMIT,
  billingHistoryResponseSchema,
  billingHistorySchema,
  billingRecordSchema,
} from "../../control-plane/billing-history.js"
import type { BillingRecord } from "../../control-plane/billing-history.js"
import { planDocumentSchema } from "../../control-plane/plan-document.js"
import { planDocument } from "./fixtures.js"

const TERMS = {
  period: "monthly",
  price: 149_000,
  trial_started_on: "2026-11-01",
  trial_ends_on: "2026-11-15",
}

describe("plan document: the subscription's terms (adr/0061 Ek C20)", () => {
  it("takes a billing summary with the terms, with them null and without them", () => {
    const full = { ...planDocument, billing: { ...planDocument.billing, ...TERMS } }
    const noTrial = {
      ...planDocument,
      billing: {
        ...planDocument.billing,
        period: "yearly",
        price: null,
        trial_started_on: null,
        trial_ends_on: null,
      },
    }

    expect(planDocumentSchema.parse(full)).toEqual(full)
    expect(planDocumentSchema.parse(noTrial)).toEqual(noTrial)
    // An older control plane's document, without them
    expect(planDocumentSchema.parse(planDocument)).toEqual(planDocument)
  })

  it.each([
    ["an unknown period", { period: "weekly" }],
    ["a negative price", { price: -1 }],
    ["a fractional price", { price: 1.5 }],
    ["a trial day that is a time", { trial_ends_on: "2026-11-15T00:00:00Z" }],
    ["an unknown term", { trial_days: 14 }],
  ])("refuses %s", (_case, extra) => {
    const document = { ...planDocument, billing: { ...planDocument.billing, ...extra } }

    expect(planDocumentSchema.safeParse(document).success).toBe(false)
  })
})

const record = (changes: Partial<BillingRecord> = {}): BillingRecord => ({
  id: "chg_01JABC",
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
  ...changes,
})

describe("billing history (adr/0061 Ek C20)", () => {
  it("accepts a shop's records, an invoice link over https and an empty history", () => {
    const history = {
      tenant_id: "ten_01J",
      records: [
        record({ invoice_number: "QTC2026000001", invoice_url: "https://e.example/f/1.pdf" }),
        record({ id: "chg_02", status: "open", paid_on: null }),
      ],
    }

    expect(billingHistorySchema.parse(history)).toEqual(history)
    expect(billingHistorySchema.safeParse({ tenant_id: "ten_01J", records: [] }).success).toBe(true)
  })

  it.each([
    ["a voided charge", { status: "void" }],
    ["the bank's reference", { reference: "EFT 2611" }],
    ["who settled it", { settled_by: "user_01" }],
    ["an http invoice link", { invoice_url: "http://e.example/f/1.pdf" }],
    ["a script link", { invoice_url: "javascript:alert(1)" }],
    ["a link with credentials", { invoice_url: "https://a:b@e.example/f.pdf" }],
    ["an invoice number with a bidi override", { invoice_number: "QTC‮1" }],
    ["another currency", { currency: "EUR" }],
    ["an id of another kind", { id: "sub_01" }],
  ])("refuses %s", (_case, changes) => {
    expect(billingRecordSchema.safeParse({ ...record(), ...changes }).success).toBe(false)
  })

  it("holds the history to its limit, and the answer to its binding", () => {
    const many = Array.from({ length: BILLING_HISTORY_LIMIT + 1 }, () => record())
    const history = { tenant_id: "ten_01J", records: [record()] }
    const binding = { kid: "0123456789abcdef", signature: "A".repeat(86) }

    expect(billingHistorySchema.safeParse({ tenant_id: "ten_01J", records: many }).success).toBe(
      false
    )
    expect(billingHistoryResponseSchema.safeParse({ history, binding }).success).toBe(true)
    expect(billingHistoryResponseSchema.safeParse({ history }).success).toBe(false)
    expect(
      billingHistoryResponseSchema.safeParse({ history, binding: { ...binding, alg: "none" } })
        .success
    ).toBe(false)
  })
})
