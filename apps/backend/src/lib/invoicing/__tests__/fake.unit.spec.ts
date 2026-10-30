import { fakeInvoiceProvider } from "../fake"
import type { InvoiceDraft } from "../types"

const draft = (kind: "person" | "company") =>
  ({
    buyer: { kind },
    totals: { net: "100.00", vat: "20.00", gross: "120.00" },
  }) as unknown as InvoiceDraft

describe("the fake invoice program (development and tests)", () => {
  it("issues at once: an e-Arşiv for a person, an e-Fatura for a company, each with a PDF", async () => {
    const state = {
      id: "inv_01M670MWBWEJAWG12S2AR2AMBZ",
      external_id: null,
      document_id: null,
      document_type: null,
      job_id: null,
      job_started_at: null,
      number: null,
    }
    const context = (kind: "person" | "company") => ({
      draft: () => Promise.resolve(draft(kind)),
      keep: () => Promise.resolve(true),
      now: () => new Date("2026-10-31T09:00:00Z"),
    })

    const person = await fakeInvoiceProvider.advance(state, context("person"))
    const company = await fakeInvoiceProvider.advance(state, context("company"))

    expect(person).toMatchObject({ next: "issued", progress: { document_type: "e_archive" } })
    expect(person.next === "issued" && person.progress.number).toBe("TST2026S2AR2AMBZ")
    expect(company).toMatchObject({
      next: "issued",
      progress: { document_type: "e_invoice", cancellable_until: null },
    })
    expect(person.next === "issued" && person.pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
