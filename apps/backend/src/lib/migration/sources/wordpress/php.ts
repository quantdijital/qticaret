/**
 * A value PHP's `serialize()` wrote, as WordPress keeps some meta
 * (`_product_attributes`, a term's `cat_meta`, Rank Math's robots): read
 * as data only. Strings, numbers, booleans, null and arrays; an object or
 * a reference is never made, the whole value is then unread. A string
 * whose byte count was spoilt (a search-and-replace that changed a URL)
 * is read up to its closing quote. Caps on size, depth and entries.
 */

export type PhpValue = null | boolean | number | string | PhpArray
export type PhpArray = Map<string, PhpValue>

const MAX_BYTES = 1024 * 1024
const MAX_DEPTH = 8
const MAX_ENTRIES = 10_000

class Unreadable extends Error {}

const QUOTE = 0x22
const SEMICOLON = 0x3b

/** The value, or undefined for text that is no serialized value (or one not read). */
export function unserialize(text: string): PhpValue | undefined {
  const bytes = Buffer.from(text.trim(), "utf8")
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return undefined
  }
  let at = 0
  let entries = 0
  const fail = (): never => {
    throw new Unreadable()
  }
  const expect = (char: string) => {
    if (bytes[at] !== char.charCodeAt(0)) {
      fail()
    }
    at += 1
  }
  const until = (char: string) => {
    const end = bytes.indexOf(char.charCodeAt(0), at)
    if (end === -1) {
      return fail()
    }
    const part = bytes.toString("latin1", at, end)
    at = end + 1
    return part
  }
  const count = (part: string) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= MAX_ENTRIES ? n : fail()
  }
  const value = (depth: number): PhpValue => {
    const type = String.fromCharCode(bytes[at] ?? 0)
    at += 1
    switch (type) {
      case "N":
        expect(";")
        return null
      case "b":
        expect(":")
        return until(";") === "1"
      case "i":
      case "d": {
        expect(":")
        const n = Number(until(";"))
        return Number.isFinite(n) ? n : fail()
      }
      case "s": {
        expect(":")
        const length = count(until(":"))
        expect('"')
        let end = at + length
        // A count that misses the closing quote: the string runs to the first `";`
        if (bytes[end] !== QUOTE || bytes[end + 1] !== SEMICOLON) {
          end = bytes.indexOf('";', at, "latin1")
          if (end === -1) {
            fail()
          }
        }
        const string = bytes.toString("utf8", at, end)
        at = end + 2
        return string
      }
      case "a": {
        expect(":")
        const size = count(until(":"))
        expect("{")
        if (depth >= MAX_DEPTH) {
          fail()
        }
        const array: PhpArray = new Map()
        for (let index = 0; index < size; index++) {
          const raw = value(depth + 1)
          const key = typeof raw === "string" || typeof raw === "number" ? String(raw) : fail()
          entries += 1
          if (entries > MAX_ENTRIES) {
            fail()
          }
          array.set(key, value(depth + 1))
        }
        expect("}")
        return array
      }
      default:
        // An object (O, C) or a reference (r, R): never read
        return fail()
    }
  }
  try {
    const result = value(0)
    return at === bytes.length ? result : undefined
  } catch (error) {
    if (error instanceof Unreadable) {
      return undefined
    }
    throw error
  }
}

/** An array's entry, if it is one. */
export const entryOf = (value: PhpValue | undefined, key: string): PhpValue | undefined =>
  value instanceof Map ? value.get(key) : undefined

/** A scalar entry as text ("" for none or an array). */
export const textOf = (value: PhpValue | undefined): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : typeof value === "boolean"
      ? value
        ? "1"
        : "0"
      : ""
