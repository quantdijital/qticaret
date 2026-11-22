import { describe, expect, it } from "vitest"
import type { LegalIdentity } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { identityRows } from "../content-extras"
import { identityLinesOf } from "../legal"

// adr/0076 §12: the licence line a shop's trade asks it to show, named by the shop

const identity = (over: Partial<LegalIdentity> = {}): LegalIdentity => ({
  company_title: "Örnek Turizm Ltd. Şti.",
  mersis: "0123456789000015",
  tax_office: null,
  tax_number: null,
  address: null,
  kep: null,
  etbis: null,
  same_as: [],
  email: null,
  phone: null,
  whatsapp: null,
  opening_hours: [],
  map_url: null,
  ...over,
})

describe("the licence line", () => {
  it("adds nothing without one: the footer's lines and the imprint stay as they were", () => {
    expect(identityLinesOf(identity(), t)).toEqual(["MERSİS: 0123456789000015"])
    expect(identityLinesOf(identity({ document: null }), t)).toEqual(["MERSİS: 0123456789000015"])
    expect(identityRows(identity(), t)).toEqual(identityRows(identity({ document: null }), t))
  })

  it("follows the law's lines in the footer, by the shop's own name for it", () => {
    expect(
      identityLinesOf(
        identity({ document: { name: "TÜRSAB belge no", number: "12345", holder: null } }),
        t
      )
    ).toEqual(["MERSİS: 0123456789000015", "TÜRSAB belge no: 12345"])
    expect(
      identityLinesOf(
        identity({
          document: { name: "TÜRSAB belge no", number: "12345", holder: "Örnek Seyahat Acentası" },
        }),
        t
      ).at(-1)
    ).toBe("TÜRSAB belge no: 12345 (Örnek Seyahat Acentası)")
  })

  it("ends the imprint on the contact page", () => {
    expect(
      identityRows(
        identity({ document: { name: "İşletme belgesi", number: "A-77", holder: "Örnek Otel" } }),
        t
      ).at(-1)
    ).toEqual({ label: "İşletme belgesi", value: "A-77 (Örnek Otel)" })
  })
})
