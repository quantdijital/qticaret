import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { invoiceNoteOf } from "../checkout"

describe("invoiceNoteOf", () => {
  it("tells a guest the invoice is personal and how to get a company one", () => {
    expect(invoiceNoteOf(t, false, null)).toEqual({
      text: t("checkout.invoice_guest"),
      link: { label: t("checkout.invoice_sign_in"), path: "/hesap/giris?sonra=%2Fodeme" },
    })
  })

  it("offers a signed-in customer without billing details to add them", () => {
    expect(invoiceNoteOf(t, true, null).link?.path).toBe("/hesap/bilgiler#fatura")
  })

  it("names the company with its tax id masked", () => {
    const note = invoiceNoteOf(t, true, {
      type: "corporate",
      legalName: "Örnek Ticaret A.Ş.",
      taxOffice: "Kadıköy",
      taxIdMasked: "••••••1234",
    })
    expect(note.text).toBe("Fatura: Örnek Ticaret A.Ş. · Kadıköy V.D. · VKN ••••••1234")
  })
})
