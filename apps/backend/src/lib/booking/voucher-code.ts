import { randomBytes } from "node:crypto"

/**
 * A booking voucher's check code (adr/0076 §13, Ek D7b): 80 bits from the
 * system's cryptographic source, written as 16 Crockford base32
 * characters (no I, L, O, U), shown in groups of four. It names no one:
 * staff type it at the departure to see whether the booking stands.
 * Read back forgivingly: case, spaces and dashes do not matter, and the
 * letters people mistake for digits (O, I, L) are read as 0 and 1.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const VOUCHER_CODE_LENGTH = 16
const BYTES = 10

/** A new code, 16 characters with no separators (as stored). */
export function newVoucherCode(random: (size: number) => Buffer = randomBytes): string {
  const bytes = random(BYTES)
  if (bytes.length !== BYTES) {
    throw new Error("voucher code: short random read")
  }
  let bits = 0n
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte)
  }
  let code = ""
  for (let index = VOUCHER_CODE_LENGTH - 1; index >= 0; index -= 1) {
    code += ALPHABET.charAt(Number((bits >> BigInt(index * 5)) & 31n))
  }
  return code
}

/** A typed code as stored, or null when it cannot be one (wrong length or character). */
export function normalizeVoucherCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 64) {
    return null
  }
  const code = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1")
  if (code.length !== VOUCHER_CODE_LENGTH) {
    return null
  }
  for (const char of code) {
    if (!ALPHABET.includes(char)) {
      return null
    }
  }
  return code
}

/** The code as people read it: `ABCD-EFGH-JKMN-PQRS`. */
export const formatVoucherCode = (code: string): string => code.match(/.{1,4}/g)?.join("-") ?? code
