import { describe, expect, it } from "vitest"
import { z } from "zod"
import { postalCodeFits, sameName, trAddressShape } from "./schema"

const phone = z.object({ phone: trAddressShape.phone })
const provinces = [
  { id: "1", code: "06", name: "Ankara" },
  { id: "2", code: "34", name: "İstanbul" },
]

describe("Turkish address form rules", () => {
  it("takes Turkish phone numbers as people write them, or none", () => {
    for (const value of [
      "",
      "+90 216 555 12 34",
      "0532 123 45 67",
      "(0212) 555-1234",
      "5321234567",
    ]) {
      expect(phone.safeParse({ phone: value }).success).toBe(true)
    }
    for (const value of ["12345", "+49 30 1234567", "0 800 123 45 67"]) {
      expect(phone.safeParse({ phone: value }).success).toBe(false)
    }
  })

  it("wants a postal code in the chosen province", () => {
    expect(postalCodeFits({ postal_code: "34710", province: "İstanbul" }, provinces)).toBe(true)
    expect(postalCodeFits({ postal_code: "06420", province: "İstanbul" }, provinces)).toBe(false)
    expect(postalCodeFits({ postal_code: "", province: "İstanbul" }, provinces)).toBe(true)
  })

  it("compares place names the Turkish way", () => {
    expect(sameName("istanbul", "İstanbul")).toBe(true)
    expect(sameName("IĞDIR", "Iğdır")).toBe(true)
    expect(sameName("Izmir", "İzmir")).toBe(false)
  })
})
