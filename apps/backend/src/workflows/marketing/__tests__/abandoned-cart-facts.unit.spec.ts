import { emailReminderBlock, whatsappNumber } from "../abandoned-cart-facts"
import type { EmailReminderFacts } from "../abandoned-cart-facts"

const ready: EmailReminderFacts = {
  email: "ayse@example.com",
  wholesale: false,
  consent: "granted",
  suppressed: false,
  reminded: false,
  remindedLately: false,
  storefront: true,
}

describe("abandoned cart actions (İYS)", () => {
  it("lets a consenting address be reminded once", () => {
    expect(emailReminderBlock(ready)).toBeNull()
  })

  it.each([
    [{ email: null }, "no_email"],
    // ADR-0068 decision 16: never to a wholesaler, consent or not
    [{ wholesale: true }, "wholesale"],
    [{ reminded: true }, "reminded"],
    [{ consent: null }, "no_consent"],
    [{ consent: "revoked" }, "no_consent"],
    [{ suppressed: true }, "suppressed"],
    [{ remindedLately: true }, "reminded_lately"],
    [{ storefront: false }, "no_storefront"],
  ] as const)("refuses %j with %s", (change, reason) => {
    expect(emailReminderBlock({ ...ready, ...change })).toBe(reason)
  })

  it("says the cart was reminded before it says consent is missing", () => {
    expect(emailReminderBlock({ ...ready, reminded: true, consent: null })).toBe("reminded")
  })

  it("offers WhatsApp for a consenting Turkish mobile only", () => {
    expect(whatsappNumber("+905321234567", "granted", false)).toBe("905321234567")
    expect(whatsappNumber("+905321234567", null, false)).toBeNull()
    expect(whatsappNumber("+905321234567", "revoked", false)).toBeNull()
    expect(whatsappNumber("+905321234567", "granted", true)).toBeNull()
    // A landline has no WhatsApp; a number as typed is not one
    expect(whatsappNumber("+902161234567", "granted", false)).toBeNull()
    expect(whatsappNumber("0532 123 45 67", "granted", false)).toBeNull()
    expect(whatsappNumber(null, "granted", false)).toBeNull()
  })
})
