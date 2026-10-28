import { randomBytes } from "node:crypto"
import { recipientOfToken, unsubscribeToken } from "../unsubscribe"

/** adr/0038 §1: a way out names its recipient by hash, signed, and opens nothing else. */
describe("unsubscribe token", () => {
  const key = randomBytes(32)
  const hash = randomBytes(32).toString("hex")

  it("names its own recipient", () => {
    expect(recipientOfToken(unsubscribeToken(hash, key), key)).toBe(hash)
  })

  it("names no one when changed, signed by another key, or no token at all", () => {
    const token = unsubscribeToken(hash, key)
    const other = randomBytes(32).toString("hex")
    expect(recipientOfToken(`${other}${token.slice(64)}`, key)).toBeNull()
    expect(recipientOfToken(token, randomBytes(32))).toBeNull()
    for (const bad of ["", hash, `${token}x`, token.toUpperCase()]) {
      expect(recipientOfToken(bad, key)).toBeNull()
    }
  })
})
