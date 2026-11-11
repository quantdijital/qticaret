import { heirOnRemoval, primaryOnSave } from "../contacts"
import { customHostnameProblem, normalizeHostname, platformHostname } from "../hostname"
import { normalizePhone } from "../phone"
import { RESERVED_SLUGS, slugFromName, slugProblem } from "../slug"

describe("a shop's slug (adr/0061 §2)", () => {
  it.each(["mylarte", "bicak-atolyesi", "a1b", "x".repeat(30)])("takes %s", (slug) => {
    expect(slugProblem(slug)).toBeNull()
  })

  it.each(["ab", "1abc", "-abc", "abc-", "ab--c", "ABC", "a_b", "çatal", "x".repeat(31), ""])(
    "refuses %s",
    (slug) => {
      expect(slugProblem(slug)).toBe("cp.slug_invalid")
    }
  )

  it("refuses the names the platform answers on", () => {
    for (const slug of [
      "www",
      "api",
      "admin",
      "panel",
      "mail",
      "localhost",
      "control-plane",
      "mta-sts",
      "autodiscover",
      "webmail",
      "aapanel",
      "giris",
      "fatura",
      "smtp-relay",
    ]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true)
      expect(slugProblem(slug)).toBe("cp.slug_reserved")
    }
  })

  it("suggests one from a Turkish name", () => {
    expect(slugFromName("Bıçak Atölyesi")).toBe("bicak-atolyesi")
    expect(slugFromName("My L'arte")).toBe("my-larte")
    expect(slugFromName("  Şişli Çiçekçisi  ")).toBe("sisli-cicekcisi")
    expect(slugFromName("123 Kahve")).toBe("kahve")
  })
})

describe("a shop's host names", () => {
  it("puts the subdomain under the platform's domain", () => {
    expect(platformHostname("mylarte", "localhost")).toBe("mylarte.localhost")
    expect(normalizeHostname(" WWW.MyLarte.com. ")).toBe("www.mylarte.com")
  })

  it.each([
    ["mylarte.com", null],
    ["www.mylarte.com.tr", null],
    ["xn--bak-ppa.com", null],
    ["localhost", "cp.domain_invalid"],
    ["mylarte", "cp.domain_invalid"],
    ["my_larte.com", "cp.domain_invalid"],
    ["-a.com", "cp.domain_invalid"],
    ["10.0.0.1", "cp.domain_invalid"],
    ["shop.localhost", "cp.domain_invalid"],
    ["a.quantticaret.com", "cp.domain_platform"],
    ["quantticaret.com", "cp.domain_platform"],
  ])("judges %s", (hostname, problem) => {
    expect(customHostnameProblem(hostname, "quantticaret.com")).toBe(problem)
  })
})

describe("a contact's phone number", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["532 123 4567", "+905321234567"],
    ["+90 (532) 123-45-67", "+905321234567"],
    ["00905321234567", "+905321234567"],
    ["0212 345 67 89", "+902123456789"],
    ["0850 123 45 67", "+908501234567"],
    ["+49 30 1234567", "+49301234567"],
  ])("reads %s as %s", (written, e164) => {
    expect(normalizePhone(written)).toBe(e164)
  })

  it.each(["123", "0632 123 45 67", "+90 532 123", "telefon", "+0123456789"])(
    "refuses %s",
    (written) => {
      expect(normalizePhone(written)).toBeNull()
    }
  )
})

describe("the primary billing contact", () => {
  const contacts = [
    { id: "a", role: "owner" as const, is_primary_billing: true },
    { id: "b", role: "technical" as const, is_primary_billing: false },
    { id: "c", role: "billing" as const, is_primary_billing: false },
  ]

  it("gives the mark to the first contact of a shop without one", () => {
    expect(primaryOnSave([], null, undefined)).toEqual({ primary: true, demote: [] })
    expect(primaryOnSave(contacts, null, undefined)).toEqual({ primary: false, demote: [] })
  })

  it("moves the mark when asked, and keeps it when not", () => {
    expect(primaryOnSave(contacts, "c", true)).toEqual({ primary: true, demote: ["a"] })
    expect(primaryOnSave(contacts, "a", undefined)).toEqual({ primary: true, demote: [] })
    expect(primaryOnSave(contacts, "a", false)).toEqual({ primary: false, demote: [] })
  })

  it("passes it to the oldest billing contact, else the oldest one left", () => {
    expect(heirOnRemoval(contacts, "a")).toBe("c")
    expect(heirOnRemoval(contacts.slice(0, 2), "a")).toBe("b")
    expect(heirOnRemoval(contacts, "b")).toBeNull()
    expect(heirOnRemoval(contacts.slice(0, 1), "a")).toBeNull()
  })
})
