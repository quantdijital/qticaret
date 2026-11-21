/**
 * Values for a product's empty attributes (adr/0074 §5 madde 3), as the
 * backend answers them: by attribute key, each already checked there
 * against its attribute (an option of its list, a number, a yes or no, a
 * short text). Read again here, value by value: anything of another shape
 * is never used.
 */

export type AiAttributeValue = string | number | boolean | string[]

export interface AiAttributeSuggestions {
  values: Record<string, AiAttributeValue>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const valueOf = (value: unknown): AiAttributeValue | null => {
  if (typeof value === "string") {
    return value.trim() === "" ? null : value
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "boolean") {
    return value
  }
  if (Array.isArray(value)) {
    const items = value.filter((each): each is string => typeof each === "string" && each !== "")
    return items.length > 0 ? items : null
  }
  return null
}

/** The values of an answer, or null when it holds none of ours. */
export function readAttributeSuggestions(value: unknown): AiAttributeSuggestions | null {
  if (!isRecord(value) || !isRecord(value["values"])) {
    return null
  }
  const values: Record<string, AiAttributeValue> = {}
  for (const [key, raw] of Object.entries(value["values"])) {
    const read = valueOf(raw)
    if (read !== null && !Object.hasOwn(Object.prototype, key)) {
      values[key] = read
    }
  }
  return { values }
}
