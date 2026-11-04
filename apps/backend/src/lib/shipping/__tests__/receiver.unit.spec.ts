import { isValidationError } from "../../errors"
import { localPhone, receiverError, receiverOf, shipmentReceiverOf } from "../receiver"

const address = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "05321234567",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Moda Mah.",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: null,
  country_code: "tr",
}

const keyOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "other"
  }
  return "none"
}

describe("localPhone (adr/0054, 2026-11-05: normalised, not refused)", () => {
  it("writes the usual spellings of a Turkish number as a courier dials it", () => {
    for (const spelling of [
      "0532 123 45 67",
      "+90 (532) 123-45-67",
      "905321234567",
      "0090 532 123 45 67",
      "+90 0532 123 45 67",
      "5321234567",
      "532.123.45.67",
    ]) {
      expect(localPhone(spelling)).toBe("05321234567")
    }
  })

  it("takes the first number of two typed in one field", () => {
    expect(localPhone("0532 123 45 67 / 0216 555 44 33")).toBe("05321234567")
    expect(localPhone("yok, 0216 555 44 33")).toBe("02165554433")
    expect(localPhone("0532 123 45 67 veya 0216 555 44 33")).toBe("05321234567")
  })

  it("gives nothing for what is no number", () => {
    expect(localPhone("123")).toBe("")
    expect(localPhone("")).toBe("")
    expect(localPhone(null)).toBe("")
  })
})

describe("receiverOf: only what a carrier cannot do without", () => {
  it("takes an address without a country as a Turkish one, and refuses another country", () => {
    expect(receiverOf({ ...address, country_code: null }).city).toBe("İstanbul")
    expect(keyOf(() => shipmentReceiverOf({ ...address, country_code: "de" }))).toBe(
      "shipping.receiver_abroad"
    )
  })

  it("lets the company name the receiver, and the mahalle alone be the street", () => {
    expect(
      receiverOf({ ...address, first_name: "", last_name: "", company: "Örnek Ltd." })
    ).toMatchObject({
      name: "Örnek Ltd.",
    })
    expect(receiverOf({ ...address, address_1: "" })).toMatchObject({ address: "Moda Mah." })
  })

  it("leaves il and ilçe to a carrier that takes the address without them (Yurtiçi)", () => {
    const bare = { ...address, city: "", province: null }

    expect(keyOf(() => shipmentReceiverOf(bare))).toBe("shipping.receiver_place_missing")
    expect(receiverOf(bare, { place: "optional" })).toMatchObject({ town: "", city: "" })
  })

  it("names the part still missing by its own key", () => {
    expect(keyOf(() => shipmentReceiverOf({ ...address, first_name: "", last_name: "" }))).toBe(
      "shipping.receiver_name_missing"
    )
    expect(keyOf(() => shipmentReceiverOf({ ...address, address_1: "", address_2: "" }))).toBe(
      "shipping.receiver_address_missing"
    )
    expect(keyOf(() => shipmentReceiverOf({ ...address, phone: "12" }))).toBe(
      "shipping.receiver_phone_missing"
    )
    expect(receiverError("phone").field).toBe("shipping_address.phone")
    expect(receiverError("nothing_known").safeMessage).toBe("shipping.address_incomplete")
  })
})
