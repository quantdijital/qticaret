import { parseProfile, planSection } from "../fill"

describe("the provisioner's shop profile (tenant:apply-profile)", () => {
  it("fills only empty fields, each checked by the section's own schema", () => {
    const plan = planSection(
      "legal",
      { company_title: "Kendi Unvanı", tax_office: null, tax_number: "", address: null },
      {
        company_title: "Örnek Bıçak Ltd. Şti.",
        tax_office: "Kadıköy",
        tax_number: "1234567890",
        address: "Moda Cad. No:1, 34710 Kadıköy/İstanbul",
      }
    )
    expect(plan.patch).toEqual({
      tax_office: "Kadıköy",
      tax_number: "1234567890",
      address: "Moda Cad. No:1, 34710 Kadıköy/İstanbul",
    })
    expect(plan).toMatchObject({ filled: 3, kept: 1, refused: 0 })
  })

  it("normalises a phone as the panel's save would", () => {
    const plan = planSection(
      "store",
      { contact_email: null, contact_phone: null },
      { contact_email: "info@ornek.com.tr", contact_phone: "0532 123 45 67" }
    )
    expect(plan.patch).toEqual({
      contact_email: "info@ornek.com.tr",
      contact_phone: "+905321234567",
    })
    expect(plan.filled).toBe(2)
  })

  it("leaves out a field the shop refuses; the rest still go", () => {
    const plan = planSection(
      "store",
      { contact_email: null, contact_phone: null },
      { contact_email: "info@ornek.com.tr", contact_phone: "12" }
    )
    expect(plan.patch).toEqual({ contact_email: "info@ornek.com.tr" })
    expect(plan).toMatchObject({ filled: 1, kept: 0, refused: 1 })
  })

  it("leaves out what was not given", () => {
    const plan = planSection("store", { contact_email: null }, { contact_email: undefined })
    expect(plan).toEqual({ patch: {}, filled: 0, kept: 0, refused: 0 })
  })

  it("reads only a strict profile: no TCKN field, no unknown section", () => {
    expect(parseProfile('{"legal":{"tax_number":"1234567890"},"store":{}}')).toEqual({
      legal: { tax_number: "1234567890" },
      store: {},
    })
    // An 11-digit number (a TCKN) is not a VKN
    expect(parseProfile('{"legal":{"tax_number":"12345678901"},"store":{}}')).toBeNull()
    expect(parseProfile('{"legal":{"tckn":"12345678901"},"store":{}}')).toBeNull()
    expect(parseProfile('{"legal":{},"store":{},"seo":{}}')).toBeNull()
    expect(parseProfile("not json")).toBeNull()
    expect(parseProfile(null)).toBeNull()
  })
})
