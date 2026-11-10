import { createHmac } from "node:crypto"

// A copy of apps/backend/integration-tests/helpers/totp.ts (adr/0061 Ek C4):
// a test helper, not shared code

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32(text: string): Buffer {
  let bits = ""
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char)
    if (value === -1) {
      throw new Error("not a base32 secret")
    }
    bits += value.toString(2).padStart(5, "0")
  }
  const bytes = bits.match(/.{8}/g) ?? []
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)))
}

/**
 * The code an authenticator app shows for `secret` (RFC 6238: SHA-1, six
 * digits, 30-second steps, as Medusa's TOTP factor). `stepsAhead` gives a
 * neighbouring step's code: Medusa takes one step either side.
 */
export function totp(secret: string, stepsAhead = 0, now: number = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000) + stepsAhead))
  const mac = createHmac("sha1", base32(secret)).update(counter).digest()
  const offset = (mac[mac.length - 1] ?? 0) & 0xf
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

/**
 * A code Medusa takes now that this test has not given yet: the control
 * plane takes each code once, and three are good at any moment.
 */
export function freshCode(secret: string, used: Set<string>): string {
  for (const step of [0, 1, -1]) {
    const code = totp(secret, step)
    if (!used.has(code)) {
      used.add(code)
      return code
    }
  }
  throw new Error("no unused code in this window: prove with a recovery code instead")
}
