/**
 * A wholesaler's password made in the panel (ADR-0068 Ek 2026-11-15 (2)):
 * staff hand it to the wholesaler, so no letters that read alike (0/O,
 * 1/l/I), and the browser's own random source. The server checks it by
 * the platform's rule (adr/0043) like any other.
 */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWER = "abcdefghijkmnpqrstuvwxyz"
const DIGITS = "23456789"
const ALL = UPPER + LOWER + DIGITS

/** The shortest password the platform takes (adr/0043). */
export const MIN_PASSWORD = 10
export const MAX_PASSWORD = 256

const pick = (alphabet: string, random: number) => alphabet[random % alphabet.length] ?? ""

/** A new password: 16 characters, in four groups of four, with upper, lower and a digit. */
export function generatePassword(
  random: (count: number) => Uint32Array = (count) => crypto.getRandomValues(new Uint32Array(count))
): string {
  const values = random(16)
  const chars = Array.from(values, (value) => pick(ALL, value))
  // One of each kind, in places the random numbers choose
  const kinds = [UPPER, LOWER, DIGITS]
  kinds.forEach((alphabet, index) => {
    const at = ((values[index] ?? 0) % 4) + index * 4
    chars[at] = pick(alphabet, values[(index + 8) % 16] ?? 0)
  })
  return [0, 4, 8, 12].map((start) => chars.slice(start, start + 4).join("")).join("-")
}
