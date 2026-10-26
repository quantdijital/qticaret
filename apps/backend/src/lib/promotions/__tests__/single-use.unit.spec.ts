import { CODE_ALPHABET, batchPrefix, freshCodes, normalizeCode, singleUseCode } from ".."

describe("single-use codes (F4.6)", () => {
  it("starts with the template's code and reads without mix-ups", () => {
    const code = singleUseCode("YAZ10")
    expect(code).toMatch(/^YAZ10-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/)
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/)
    // Already in the stored form: a shopper typing it lower case finds it
    expect(normalizeCode(code.toLowerCase())).toBe(code)
  })

  it("keeps the prefix in the stored form and within 40 characters a code may have", () => {
    expect(batchPrefix(" yaz-indirimi ")).toBe("YAZ-INDIRIMI")
    const long = batchPrefix("A".repeat(60))
    expect(`${long}-${"X".repeat(8)}`).toHaveLength(40)
    expect(batchPrefix("KIS--")).toBe("KIS")
  })

  it("draws codes no one has, none twice", () => {
    // A source that repeats: the first draws clash with a taken code and each other
    const sequence = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
    let at = 0
    const repeating = () => sequence[at++ % sequence.length] ?? 0
    const taken = new Set(["P-22222222"])
    expect(freshCodes("P", 1, taken, repeating)).toEqual(["P-33333333"])
    const many = freshCodes("P", 500, new Set())
    expect(new Set(many).size).toBe(500)
  })

  it("gives up on a random source that never gives anything new", () => {
    expect(() => freshCodes("P", 2, new Set(), () => 0)).toThrow("could not draw")
  })
})
