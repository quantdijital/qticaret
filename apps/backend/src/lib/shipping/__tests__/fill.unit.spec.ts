import { addressFieldsOf, filledReceiver } from "../fill"

const shipping = {
  id: "oaddr_1",
  metadata: { from: "checkout" },
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "+90 532 123 45 67",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Caferağa",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}
const billing = { first_name: "Mehmet", last_name: "Kaya", phone: "0216 555 44 33" }
const customer = { first_name: "Ayşe", last_name: "Yılmaz", phone: "05559998877" }

describe("filledReceiver (adr/0054, 2026-11-05: ship first, fill in by itself)", () => {
  it("keeps a complete address as it is, its phone written as a courier dials it", () => {
    const { address, plate, filled } = filledReceiver(shipping, { billing, customer })

    expect(address).toEqual({
      ...addressFieldsOf(shipping),
      company: null,
      phone: "05321234567",
    })
    expect(address).not.toHaveProperty("id")
    expect(plate).toBe("34")
    expect(filled).toEqual([])
  })

  it("takes a missing phone from the billing address, else from the customer's account", () => {
    expect(filledReceiver({ ...shipping, phone: "" }, { billing, customer })).toMatchObject({
      address: { phone: "02165554433" },
      filled: ["phone"],
    })
    expect(
      filledReceiver(
        { ...shipping, phone: "yok" },
        { billing: { ...billing, phone: null }, customer }
      ).address.phone
    ).toBe("05559998877")
    // None better: the delivery address's own is left for the carrier rule to name
    expect(filledReceiver({ ...shipping, phone: "12" }).address.phone).toBe("12")
  })

  it("takes a missing name from the billing address, else from the account; never over a company", () => {
    const nameless = { ...shipping, first_name: " ", last_name: null }

    expect(filledReceiver(nameless, { billing, customer }).address).toMatchObject({
      first_name: "Mehmet",
      last_name: "Kaya",
    })
    expect(filledReceiver(nameless, { customer }).filled).toEqual(["first_name"])
    expect(filledReceiver({ ...nameless, company: "Örnek Ltd." }, { billing }).filled).toEqual([])
  })

  it("puts in the postcode and plate code the address data knows, and Türkiye for no country", () => {
    const { address, plate, filled } = filledReceiver(
      { ...shipping, postal_code: "", country_code: null },
      { place: { postal_code: "34710", plate: "34" } }
    )

    expect(address).toMatchObject({ postal_code: "34710", country_code: "tr" })
    expect(plate).toBe("34")
    expect(filled).toEqual(["country_code", "postal_code"])
    // A neighbourhood the data does not know: the province's plate code still finds the city
    expect(
      filledReceiver(
        { ...shipping, postal_code: null },
        { place: { postal_code: null, plate: "34" } }
      )
    ).toMatchObject({ address: { postal_code: null }, plate: "34" })
  })
})
