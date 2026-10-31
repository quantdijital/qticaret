import { securityTxt } from "../security-txt"

const NOW = new Date("2026-10-31T05:30:00Z")

describe("security.txt", () => {
  it("names the contacts, expires within a year and points at its canonical address", () => {
    expect(
      securityTxt({
        contacts: "mailto:guvenlik@example.com, https://example.com/bildir",
        policyUrl: "https://example.com/guvenlik",
        canonicalHost: "magaza.example.com",
        now: NOW,
      })
    ).toBe(
      [
        "Contact: mailto:guvenlik@example.com",
        "Contact: https://example.com/bildir",
        "Expires: 2027-04-29T00:00:00.000Z",
        "Preferred-Languages: tr, en",
        "Policy: https://example.com/guvenlik",
        "Canonical: https://magaza.example.com/.well-known/security.txt",
        "",
      ].join("\n")
    )
  })

  it("says nothing without a usable contact, and skips what is not an address", () => {
    expect(
      securityTxt({ contacts: undefined, policyUrl: undefined, canonicalHost: null })
    ).toBeNull()
    expect(
      securityTxt({ contacts: "guvenlik@example.com", policyUrl: undefined, canonicalHost: null })
    ).toBeNull()
    expect(
      securityTxt({
        contacts: "mailto:a@b.co, http://insecure.example.com",
        policyUrl: "http://example.com",
        canonicalHost: null,
        now: NOW,
      })
    ).toBe(
      "Contact: mailto:a@b.co\nExpires: 2027-04-29T00:00:00.000Z\nPreferred-Languages: tr, en\n"
    )
  })
})
