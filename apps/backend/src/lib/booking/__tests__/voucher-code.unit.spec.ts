import {
  VOUCHER_CODE_LENGTH,
  formatVoucherCode,
  newVoucherCode,
  normalizeVoucherCode,
} from "../voucher-code"

const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/

describe("a booking voucher's check code (adr/0076 §13, Ek D7b)", () => {
  it("is 16 Crockford characters from 80 random bits", () => {
    const code = newVoucherCode()
    expect(code).toHaveLength(VOUCHER_CODE_LENGTH)
    expect(code).toMatch(CROCKFORD)
  })

  it("writes every bit of the random read: all zeros and all ones are the ends", () => {
    expect(newVoucherCode((size) => Buffer.alloc(size, 0))).toBe("0000000000000000")
    expect(newVoucherCode((size) => Buffer.alloc(size, 0xff))).toBe("ZZZZZZZZZZZZZZZZ")
  })

  it("refuses a short random read", () => {
    expect(() => newVoucherCode(() => Buffer.alloc(4))).toThrow("short random read")
  })

  it("does not repeat over many draws", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => newVoucherCode()))
    expect(codes.size).toBe(5000)
  })

  it("reads a typed code forgivingly: case, spaces, dashes, O, I and L", () => {
    expect(normalizeVoucherCode("abcd-efgh-jkmn-pqrs")).toBe("ABCDEFGHJKMNPQRS")
    expect(normalizeVoucherCode(" ABCD EFGH JKMN PQRS ")).toBe("ABCDEFGHJKMNPQRS")
    expect(normalizeVoucherCode("OOOO-IIII-LLLL-0000")).toBe("0000111111110000")
  })

  it("refuses what cannot be a code", () => {
    expect(normalizeVoucherCode("ABCD-EFGH-JKMN")).toBeNull()
    expect(normalizeVoucherCode("ABCD-EFGH-JKMN-PQRU")).toBeNull()
    expect(normalizeVoucherCode("ABCD-EFGH-JKMN-PQRS-")).toBe("ABCDEFGHJKMNPQRS")
    expect(normalizeVoucherCode(12)).toBeNull()
    expect(normalizeVoucherCode("A".repeat(65))).toBeNull()
    expect(normalizeVoucherCode("ABCD;EFGH;JKMN;PQRS")).toBeNull()
  })

  it("shows the code in groups of four", () => {
    expect(formatVoucherCode("ABCDEFGHJKMNPQRS")).toBe("ABCD-EFGH-JKMN-PQRS")
  })
})
