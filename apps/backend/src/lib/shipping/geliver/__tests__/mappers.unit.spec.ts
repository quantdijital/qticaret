import { kurus } from "../../../money"
import type { AddressIncomplete } from "../mappers"
import { geliverRecipientOf, geliverSenderOf, sameSender } from "../mappers"
import { chooseQuote } from "../quotes"
import type { GeliverQuote } from "../quotes"

const address = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "+905320000000",
  address_1: "Moda Cad. No: 1 D: 2",
  address_2: "Caferağa Mah.",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}

describe("Geliver addresses (adr/0008 mapping)", () => {
  it("takes the province, district, neighbourhood and plate code as Geliver names them", () => {
    expect(geliverRecipientOf(address, "ayse@example.com")).toEqual({
      name: "Ayşe Yılmaz",
      email: "ayse@example.com",
      phone: "+905320000000",
      address1: "Caferağa Mah., Moda Cad. No: 1 D: 2",
      countryCode: "TR",
      cityName: "İstanbul",
      cityCode: "34",
      districtName: "Kadıköy",
      zip: "34710",
    })
  })

  it("says which part a carrier would miss", () => {
    const missing = (patch: Record<string, unknown>) => {
      try {
        geliverRecipientOf({ ...address, ...patch }, null)
      } catch (error) {
        return (error as AddressIncomplete).field
      }
      return "nothing"
    }

    expect(missing({ phone: "" })).toBe("phone")
    expect(missing({ country_code: "de" })).toBe("country_code")
    expect(missing({ first_name: "", last_name: " " })).toBe("first_name")
    expect(missing({ city: "" })).toBe("city")
    // Geliver's SDK: a recipient's postcode is optional; no country is Türkiye; a company names it
    expect(missing({ postal_code: "347" })).toBe("nothing")
    expect(missing({ country_code: null })).toBe("nothing")
    expect(missing({ first_name: "", last_name: "", company: "Örnek Ltd." })).toBe("nothing")
  })

  it("sends a recipient without a postcode by its city's plate code from the address data, else by name", () => {
    const bare = { ...address, postal_code: null }

    expect(geliverRecipientOf(bare, null, "34")).toMatchObject({
      cityCode: "34",
      cityName: "İstanbul",
    })
    expect(geliverRecipientOf(bare, null, "34")).not.toHaveProperty("zip")
    expect(geliverRecipientOf(bare, null)).not.toHaveProperty("cityCode")
    // The postcode's own plate wins over the data's
    expect(geliverRecipientOf(address, null, "06").cityCode).toBe("34")
  })

  it("still asks a sender for its postcode (Geliver's SDK refuses one without)", () => {
    const sender = () =>
      geliverSenderOf(
        { id: "sloc_1", name: "Ana Depo", address: { ...address, postal_code: "" } },
        { name: "Örnek", email: "depo@example.com" }
      )

    expect(sender).toThrow("postal_code")
  })

  it("marks the warehouse's sender address, and knows when it no longer says the same", () => {
    const sender = geliverSenderOf(
      { id: "sloc_1", name: "Ana Depo", address: { ...address, company: "Örnek Ticaret" } },
      { name: "Örnek", email: "depo@example.com" }
    )

    expect(sender).toMatchObject({ name: "Örnek Ticaret", shortName: "qt-sloc_1", zip: "34710" })
    expect(sameSender({ id: "a", ...sender }, sender)).toBe(true)
    expect(sameSender({ id: "a", ...sender, phone: "+905550000000" }, sender)).toBe(false)
  })
})

describe("chooseQuote (F7.2)", () => {
  const quotes: GeliverQuote[] = [
    {
      provider_code: "MNG",
      service_code: "MNG_STANDART",
      amount: kurus(6_000),
      estimated_hours: 48,
    },
    {
      provider_code: "YURTICI",
      service_code: "YURTICI_STANDART",
      amount: kurus(6_800),
      estimated_hours: 24,
    },
  ]

  it("takes the cheapest, the fastest or the named service", () => {
    expect(chooseQuote(quotes, { by: "cheapest" })?.service_code).toBe("MNG_STANDART")
    expect(chooseQuote(quotes, { by: "fastest" })?.service_code).toBe("YURTICI_STANDART")
    expect(chooseQuote(quotes, { by: "service", code: "YURTICI_STANDART" })?.amount).toBe(6_800)
    expect(chooseQuote(quotes, { by: "service", code: "PTT_KAPIDA_ODEME" })).toBeNull()
    expect(chooseQuote([], { by: "cheapest" })).toBeNull()
  })
})
