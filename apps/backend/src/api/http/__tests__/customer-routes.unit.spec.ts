import { normalizeCustomerPhone } from "../customer-routes"

describe("a customer's phone written by staff", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["+90 (532) 123-45-67", "+905321234567"],
    ["5321234567", "+905321234567"],
    ["0216 123 45 67", "+902161234567"],
  ])("puts %s as %s", (typed, stored) => {
    const body: Record<string, unknown> = { phone: typed }
    normalizeCustomerPhone(body)
    expect(body["phone"]).toBe(stored)
  })

  it("takes an emptied phone off and leaves a body without one alone", () => {
    const emptied: Record<string, unknown> = { phone: "  " }
    normalizeCustomerPhone(emptied)
    expect(emptied["phone"]).toBeNull()
    const none: Record<string, unknown> = { first_name: "Ayşe" }
    normalizeCustomerPhone(none)
    expect(none).toEqual({ first_name: "Ayşe" })
  })

  it.each(["12345", "0532 123", "+44 20 7946 0958", "telefon"])(
    "refuses %s, naming the field",
    (typed) => {
      let thrown: unknown = null
      try {
        normalizeCustomerPhone({ phone: typed })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toMatchObject({ safeMessage: "customers.phone_invalid", field: "phone" })
    }
  )
})
