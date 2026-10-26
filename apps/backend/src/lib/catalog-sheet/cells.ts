import { isCleanText } from "../security"
import { isValidSlug, toSlug } from "../seo/slug"

/**
 * A cell's value as the import takes it, or the problem with it (an i18n
 * key, `catalog_import.*`); the sheet reader has already taken off the
 * apostrophe an export put before formula-like text. Numbers are read as a
 * Turkish spreadsheet writes them (`1.250,50`) or as a cell holds them
 * (`1250.5`).
 */

export type Cell<T> = { ok: true; value: T } | { ok: false; key: string }

const ok = <T>(value: T): Cell<T> => ({ ok: true, value })
const fail = (key: string): Cell<never> => ({ ok: false, key })

/** Text up to `max`; with `multiline`, line breaks too (a description's paragraphs). */
export function textCell(raw: string, max: number, { multiline = false } = {}): Cell<string> {
  const text = raw.replace(/\r\n?/g, "\n").trim()
  const clean = multiline
    ? text.split("\n").every((line) => isCleanText(line, true))
    : isCleanText(text, true)
  if (!clean) {
    return fail("catalog_import.text_invalid")
  }
  return text.length > max ? fail("catalog_import.text_too_long") : ok(text)
}

// With a comma it is Turkish (`1.250,50`); without, the dot is the decimal point
const TURKISH = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$/
const PLAIN = /^\d+(?:\.\d+)?$/

/** A number at or above zero (or below, with `signed`), at most `decimals` places, up to `max` either way. */
export function decimalCell(
  raw: string,
  {
    max,
    decimals,
    key,
    signed = false,
  }: { max: number; decimals: number; key: string; signed?: boolean }
): Cell<number> {
  const unsigned = raw.replace(/[\s\u00a0]/g, "")
  const isNegative = signed && unsigned.startsWith("-")
  const text = isNegative ? unsigned.slice(1) : unsigned
  const normalized = text.includes(",")
    ? TURKISH.test(text)
      ? text.replace(/\./g, "").replace(",", ".")
      : null
    : PLAIN.test(text)
      ? text
      : null
  if (normalized === null) {
    return fail(key)
  }
  const places = normalized.split(".")[1]?.length ?? 0
  const value = Number(normalized)
  if (places > decimals || !Number.isFinite(value) || value > max) {
    return fail(key)
  }
  return ok(isNegative ? -value : value)
}

const STATUSES: Readonly<Record<string, "draft" | "published">> = {
  taslak: "draft",
  draft: "draft",
  yayinda: "published",
  published: "published",
}

/** `Taslak` or `Yayında` (or the API's `draft`, `published`). */
export function statusCell(raw: string): Cell<"draft" | "published"> {
  const status = STATUSES[toSlug(raw)]
  return status ? ok(status) : fail("catalog_import.status_invalid")
}

/** A handle (a product's, a category's, a brand's): a slug, lower-cased. */
export function handleCell(raw: string): Cell<string> {
  const handle = raw.trim().toLowerCase()
  return isValidSlug(handle) ? ok(handle) : fail("catalog_import.handle_invalid")
}

/** Several handles: `bicak|mutfak` (or comma separated), each a slug, repeats dropped. */
export function handleListCell(raw: string): Cell<string[]> {
  const handles = [...new Set(raw.split(/[|,]/).map((each) => each.trim().toLowerCase()))].filter(
    (each) => each !== ""
  )
  return handles.every((handle) => isValidSlug(handle))
    ? ok(handles)
    : fail("catalog_import.handle_invalid")
}
