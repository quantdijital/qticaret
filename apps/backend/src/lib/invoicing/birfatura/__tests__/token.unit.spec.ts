import {
  BIRFATURA_TOKEN_PATTERN,
  birfaturaTokenMatches,
  newBirfaturaToken,
  tokenFromHeader,
} from "../token"

describe("BirFatura's connection token (adr/0072 §3)", () => {
  it("is 128 random bits written as a GUID", () => {
    const token = newBirfaturaToken()

    expect(token).toMatch(BIRFATURA_TOKEN_PATTERN)
    expect(token.replaceAll("-", "")).toHaveLength(32)
    expect(newBirfaturaToken()).not.toBe(token)
  })

  it("spends no bit on a version: every one of the 16 bytes is the random source's", () => {
    const token = newBirfaturaToken(() => Buffer.alloc(16, 0xff))

    expect(token).toBe("ffffffff-ffff-ffff-ffff-ffffffffffff")
  })

  it("matches the stored token only, whatever the header's case or spaces", () => {
    const stored = newBirfaturaToken()

    expect(birfaturaTokenMatches(tokenFromHeader(` ${stored.toUpperCase()} `), stored)).toBe(true)
    expect(birfaturaTokenMatches(tokenFromHeader(newBirfaturaToken()), stored)).toBe(false)
    expect(birfaturaTokenMatches(tokenFromHeader(stored.slice(0, 35)), stored)).toBe(false)
  })

  it("matches nothing without a header, a single one, or a stored token", () => {
    const stored = newBirfaturaToken()

    expect(birfaturaTokenMatches(tokenFromHeader(undefined), stored)).toBe(false)
    expect(birfaturaTokenMatches(tokenFromHeader([stored, stored]), stored)).toBe(false)
    expect(birfaturaTokenMatches("", "")).toBe(false)
    expect(birfaturaTokenMatches(stored, null)).toBe(false)
  })
})
