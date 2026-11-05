import { normalizeTrPhone, readableTrPhone } from "../phone"
import { normalizePlateCode, postalCodePlate } from "../postal-code"

describe("normalizeTrPhone", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["+90 (532) 123-45-67", "+905321234567"],
    ["5321234567", "+905321234567"],
    ["905321234567", "+905321234567"],
    ["00905321234567", "+905321234567"],
    ["0216 345 67 89", "+902163456789"],
    ["0850 222 11 00", "+908502221100"],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeTrPhone(input)).toBe(expected)
  })

  it.each(["", "123", "0532 123 45 6", "0632 123 45 67", "+44 20 7946 0958", "05321234567x"])(
    "rejects %p",
    (input) => {
      expect(normalizeTrPhone(input)).toBeNull()
    }
  )
})

describe("readableTrPhone", () => {
  it.each([
    ["+905342551145", "0534 255 11 45"],
    ["05342551145", "0534 255 11 45"],
    [" +90 (534) 255-11-45 ", "0534 255 11 45"],
    ["02163456789", "0216 345 67 89"],
    ["0850 222 11 00", "0850 222 11 00"],
  ])("writes %p as %p", (input, expected) => {
    expect(readableTrPhone(input)).toBe(expected)
  })

  it("leaves a number that is not Turkish as given, and nothing as null", () => {
    expect(readableTrPhone(" +44 20 7946 0958 ")).toBe("+44 20 7946 0958")
    expect(readableTrPhone("  ")).toBeNull()
    expect(readableTrPhone(null)).toBeNull()
    expect(readableTrPhone(undefined)).toBeNull()
  })
})

describe("postalCodePlate", () => {
  it.each([
    ["34710", "34"],
    ["06420", "06"],
    [" 81000 ", "81"],
  ])("returns the plate of %p", (input, plate) => {
    expect(postalCodePlate(input)).toBe(plate)
  })

  it.each(["3471", "347100", "00100", "82000", "34A10"])("rejects %p", (input) => {
    expect(postalCodePlate(input)).toBeNull()
  })
})

describe("normalizePlateCode", () => {
  it.each([
    ["6", "06"],
    ["06", "06"],
    [81, "81"],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizePlateCode(input)).toBe(expected)
  })

  it.each(["0", "82", "abc", "100"])("rejects %p", (input) => {
    expect(normalizePlateCode(input)).toBeNull()
  })
})
