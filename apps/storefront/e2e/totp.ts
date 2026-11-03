import { createHmac } from "node:crypto"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP_MS = 30_000

function base32(text: string): Buffer {
  let bits = ""
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char)
    if (value === -1) {
      throw new Error("not a base32 key")
    }
    bits += value.toString(2).padStart(5, "0")
  }
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
}

/** The 30-second step a code belongs to, now. */
export const currentStep = (): number => Math.floor(Date.now() / STEP_MS)

/**
 * An authenticator app's code for the key at a step (RFC 6238, as Medusa's
 * TOTP; the panel's e2e `support/totp.ts`, by step rather than offset).
 */
export function totpAt(key: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac("sha1", base32(key)).update(counter).digest()
  const offset = (mac[mac.length - 1] ?? 0) & 0xf
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}
