/**
 * A product's tags or categories picked from the shop's own lists
 * (adr/0074 §5 madde 2), as the backend answers them: records by id
 * (checked there against the shop's lists) and, for tags, new names
 * apart. Read again here, field by field: anything else is never used.
 */

export interface AiPickedRecord {
  id: string
  name: string
}

export interface AiPicks {
  picked: AiPickedRecord[]
  /** New tags: none exists yet; one is created only when the person picks it. */
  new_tags: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

/** The picks of an answer, or null when it holds none of ours. */
export function readPicks(value: unknown): AiPicks | null {
  if (!isRecord(value) || !Array.isArray(value["picked"])) {
    return null
  }
  const picked = value["picked"].flatMap((each: unknown) =>
    isRecord(each) && text(each["id"]) && text(each["name"])
      ? [{ id: each["id"], name: each["name"] }]
      : []
  )
  const fresh = Array.isArray(value["new_tags"]) ? value["new_tags"].filter(text) : []
  return { picked, new_tags: [...new Set(fresh)] }
}
