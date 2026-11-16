import { describe, expect, it } from "vitest"
import { MIN_PASSWORD, generatePassword } from "./password"

describe("a wholesaler's password made in the panel", () => {
  it("is four groups of four, long enough, with an upper, a lower and a digit", () => {
    for (let run = 0; run < 50; run++) {
      const password = generatePassword()
      expect(password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/)
      expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[2-9]/)
    }
  })

  it("has no characters that read alike", () => {
    // The same random number everywhere: still none of 0, O, 1, l, I
    const password = generatePassword((count) => new Uint32Array(count).fill(7))
    expect(password).not.toMatch(/[0O1lI]/)
  })
})
