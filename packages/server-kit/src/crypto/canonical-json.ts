/** JSON with sorted keys: the same settings always give the same associated data. */
export function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
  )
}

export class CanonicalJsonError extends Error {
  override readonly name = "CanonicalJsonError"
  readonly code = "canonical_json.unsupported_value"
}

// Code-unit order, not locale order: the same bytes on every machine and in
// every language, which a signature needs (adr/0061 §3.2)
const byCodeUnit = ([a]: [string, unknown], [b]: [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0

function canonical(value: unknown, path: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError(`${path} is not a finite number`)
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonical(item, `${path}[${String(index)}]`)).join(",")}]`
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(byCodeUnit)
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item, `${path}.${key}`)}`)
      .join(",")}}`
  }
  throw new CanonicalJsonError(`${path} is not plain JSON`)
}

/**
 * JSON with sorted keys at every depth, for signed documents: whoever parses
 * a document and serialises it again gets the same bytes. Only plain JSON
 * values are taken (no Date, Map, class instance, NaN or Infinity); an
 * `undefined` property is left out as `JSON.stringify` does, but one in an
 * array is refused rather than turned into `null`.
 */
export function canonicalJsonDeep(value: unknown): string {
  return canonical(value, "$")
}
