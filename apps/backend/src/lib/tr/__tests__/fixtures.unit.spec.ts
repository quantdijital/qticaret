import { fakeTckn, fakeVkn, seededRandom, trAddress, trPerson } from "@qticaret/testing"
import { isValidTckn, isValidVkn } from "@qticaret/server-kit"
import { normalizeTrPhone } from "../phone"

/** The shared fixture factories (packages/testing) pass the platform's own checks. */
describe("Turkish fixtures", () => {
  it("makes TCKNs and VKNs with valid check digits", () => {
    const random = seededRandom(42)
    for (let index = 0; index < 200; index++) {
      expect(isValidTckn(fakeTckn(random))).toBe(true)
      expect(isValidVkn(fakeVkn(random))).toBe(true)
    }
  })

  it("repeats with the same seed", () => {
    expect(trPerson(seededRandom(7))).toEqual(trPerson(seededRandom(7)))
  })

  it("makes people PayTR and the address rules accept", () => {
    const person = trPerson(seededRandom(3))
    const address = trAddress(seededRandom(3))

    expect(person.email).toMatch(/^[a-z0-9.]+@example\.com$/)
    expect(normalizeTrPhone(person.phone)).toBe(person.phone)
    expect(address.postalCode).toMatch(/^\d{5}$/)
  })
})
