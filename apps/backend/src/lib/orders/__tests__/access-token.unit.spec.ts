import { randomBytes } from "node:crypto"
import { ORDER_ACCESS_DAYS, opensOrder, orderAccessToken } from "../access-token"

/** adr/0037 §2: a guest's link opens their own order, for a while, and nothing else. */
describe("order access token", () => {
  const key = randomBytes(32)
  const order = { id: "order_01TEST", email: "Ayse@Example.com" }
  const now = new Date("2026-10-28T12:00:00Z")
  const token = orderAccessToken(key, order, now)

  it("opens its own order, whatever the e-mail's case", () => {
    expect(opensOrder(key, token, { ...order, email: "ayse@example.com" }, now)).toBe(true)
  })

  it("opens no other order, nor this one under another address or key", () => {
    expect(opensOrder(key, token, { ...order, id: "order_01OTHER" }, now)).toBe(false)
    expect(opensOrder(key, token, { ...order, email: "baska@example.com" }, now)).toBe(false)
    expect(opensOrder(key, token, { ...order, email: null }, now)).toBe(false)
    expect(opensOrder(randomBytes(32), token, order, now)).toBe(false)
  })

  it("stops at its end, and a changed end breaks it", () => {
    const later = new Date(now.getTime() + (ORDER_ACCESS_DAYS + 1) * 24 * 60 * 60 * 1000)
    expect(opensOrder(key, token, order, later)).toBe(false)
    const [, mac] = token.split(".")
    const stretched = `${Math.floor(later.getTime() / 1000 + 3600).toString(36)}.${mac ?? ""}`
    expect(opensOrder(key, stretched, order, now)).toBe(false)
  })

  it("refuses what is not a token", () => {
    for (const bad of ["", "abc", `${token}x`, token.replace(".", ""), `../${token}`]) {
      expect(opensOrder(key, bad, order, now)).toBe(false)
    }
  })
})
