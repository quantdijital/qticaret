import { detectTaxIdKind, isValidTckn, isValidVkn, maskTaxId } from "../tax-id"

// Widely published algorithmic test numbers, not real people or companies.
const VALID_TCKN = ["10000000146", "12345678950"]
const VALID_VKN = ["1234567890", "0000000001"]

describe("isValidTckn", () => {
  it.each(VALID_TCKN)("accepts %p", (value) => {
    expect(isValidTckn(value)).toBe(true)
  })

  it.each([
    ["wrong tenth digit", "10000000156"],
    ["wrong eleventh digit", "10000000147"],
    ["leading zero", "02345678950"],
    ["too short", "1000000014"],
    ["not digits", "1000000014a"],
  ])("rejects %s", (_reason, value) => {
    expect(isValidTckn(value)).toBe(false)
  })
})

describe("isValidVkn", () => {
  it.each(VALID_VKN)("accepts %p", (value) => {
    expect(isValidVkn(value)).toBe(true)
  })

  it.each(["1234567891", "0000000000", "123456789", "12345678901", "12345 7890"])(
    "rejects %p",
    (value) => {
      expect(isValidVkn(value)).toBe(false)
    }
  )
})

describe("detectTaxIdKind", () => {
  it("tells TCKN and VKN apart", () => {
    expect(detectTaxIdKind("10000000146")).toBe("tckn")
    expect(detectTaxIdKind("1234567890")).toBe("vkn")
    expect(detectTaxIdKind("1234567891")).toBeNull()
  })
})

describe("maskTaxId", () => {
  it("shows only the last four digits at the identifier's length", () => {
    expect(maskTaxId("tckn", "0146")).toBe("*******0146")
    expect(maskTaxId("vkn", "7890")).toBe("******7890")
  })
})
