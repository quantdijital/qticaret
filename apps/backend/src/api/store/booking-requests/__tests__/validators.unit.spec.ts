import { StorePostBookingRequest } from "../validators"

const base = {
  product_id: "prod_1",
  name: "  Ayşe   Yılmaz ",
  phone: "0532 123 45 67",
  adults: 2,
  consent: true,
}

const parse = (body: Record<string, unknown>) => StorePostBookingRequest.safeParse(body)

describe("StorePostBookingRequest (adr/0076 Ek 2026-11-23)", () => {
  it("takes a request with open dates and a phone only", () => {
    const parsed = parse(base)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({
      name: "Ayşe Yılmaz",
      phone: "+905321234567",
      email: "",
      note: "",
      adults: 2,
    })
  })

  it("takes one departure, one day or one month", () => {
    expect(parse({ ...base, slot_id: "bslot_1" }).success).toBe(true)
    expect(parse({ ...base, date: "2027-02-28" }).success).toBe(true)
    expect(parse({ ...base, month: "2027-03" }).success).toBe(true)
    expect(parse({ ...base, date: "2027-02-30" }).success).toBe(false)
    expect(parse({ ...base, month: "2027-13" }).success).toBe(false)
  })

  it("refuses more than one of departure, day and month", () => {
    const parsed = parse({ ...base, slot_id: "bslot_1", month: "2027-03" })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe("booking.request_when_invalid")
  })

  it("needs a Turkish phone", () => {
    expect(parse({ ...base, phone: undefined }).success).toBe(false)
    const parsed = parse({ ...base, phone: "12" })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe("contact_messages.phone_invalid")
  })

  it("takes an address when given, lowercased, and refuses a bad one", () => {
    expect(parse({ ...base, email: " Ayse@Example.COM " }).data?.email).toBe("ayse@example.com")
    expect(parse({ ...base, email: "" }).data?.email).toBe("")
    expect(parse({ ...base, email: "not-an-address" }).success).toBe(false)
  })

  it("needs the consent, an adult, and a note of 1000 characters at most", () => {
    expect(parse({ ...base, consent: false }).success).toBe(false)
    expect(parse({ ...base, consent: undefined }).success).toBe(false)
    expect(parse({ ...base, adults: 0 }).success).toBe(false)
    expect(parse({ ...base, children: -1 }).success).toBe(false)
    expect(parse({ ...base, note: "a".repeat(1000) }).success).toBe(true)
    expect(parse({ ...base, note: "a".repeat(1001) }).success).toBe(false)
  })

  it("refuses fields it does not know, a price among them", () => {
    expect(parse({ ...base, amount: 100 }).success).toBe(false)
  })
})
