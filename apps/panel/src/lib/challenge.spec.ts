import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { challengeHeader, solveChallenge, startsWithZeros } from "./challenge"

describe("proof of work (adr/0044 §1)", () => {
  it("finds a nonce the server's check accepts", async () => {
    const salt = "c2FsdC1mb3ItdGhlLXRlc3Q"
    const nonce = await solveChallenge({ salt, bits: 10 })
    const digest = createHash("sha256").update(`${salt}${nonce}`, "utf8").digest()

    expect(startsWithZeros(digest, 10)).toBe(true)
    expect(challengeHeader("login.salt.10.1.sig", nonce)).toEqual({
      "x-challenge": `login.salt.10.1.sig.${nonce}`,
    })
  })

  it("counts the zero bits of a digest", () => {
    expect(startsWithZeros(Uint8Array.from([0, 0b0011_1111]), 10)).toBe(true)
    expect(startsWithZeros(Uint8Array.from([0, 0b0100_0000]), 10)).toBe(false)
    expect(startsWithZeros(Uint8Array.from([1]), 8)).toBe(false)
  })
})
