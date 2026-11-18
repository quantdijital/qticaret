import { readInvoiceLink } from "../link"

const now = new Date("2026-11-18T09:00:00Z")

describe("BirFatura's invoiceLinkUpdate as a write-back (adr/0072 §6)", () => {
  it("takes GİB's number and BirFatura's date, in Türkiye's time", () => {
    expect(
      readInvoiceLink({ faturaNo: " abc2026000000123 ", faturaTarihi: "18.11.2026 11:30:00" }, now)
    ).toEqual({
      issued: { number: "ABC2026000000123", issued_at: new Date("2026-11-18T08:30:00Z") },
    })
  })

  it("dates an invoice sent without a date now", () => {
    expect(readInvoiceLink({ faturaNo: "ABC2026000000123", faturaTarihi: null }, now)).toEqual({
      issued: { number: "ABC2026000000123", issued_at: now },
    })
  })

  it("says the number is missing when BirFatura sends none (its document allows it)", () => {
    expect(readInvoiceLink({}, now)).toEqual({ missing: true })
    expect(readInvoiceLink({ faturaNo: "  " }, now)).toEqual({ missing: true })
  })

  it.each([
    ["not GİB's shape", { faturaNo: "ABC-123" }, "einvoice.number_invalid"],
    ["too short", { faturaNo: "ABC202600000012" }, "einvoice.number_invalid"],
    [
      "a date that is not one",
      { faturaNo: "ABC2026000000123", faturaTarihi: "2026-11-18" },
      "einvoice.issued_at_invalid",
    ],
    [
      "a date days ahead",
      { faturaNo: "ABC2026000000123", faturaTarihi: "25.11.2026 10:00:00" },
      "einvoice.issued_at_invalid",
    ],
    [
      "another year than the number's",
      { faturaNo: "ABC2025000000123", faturaTarihi: "18.11.2026 10:00:00" },
      "einvoice.number_year",
    ],
  ])("refuses %s", (_name, body, problem) => {
    expect(readInvoiceLink(body, now)).toEqual({ problem })
  })

  it("reads the year in Türkiye: an invoice just past midnight on 1 January is the new year's", () => {
    const newYear = new Date("2026-12-31T21:30:00Z")

    expect(
      readInvoiceLink(
        { faturaNo: "ABC2027000000001", faturaTarihi: "01.01.2027 00:30:00" },
        newYear
      )
    ).toEqual({ issued: { number: "ABC2027000000001", issued_at: newYear } })
  })
})
