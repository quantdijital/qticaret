import { ValidationError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { mergePatch } from "./define"
import { sectionOf } from "./index"
import type { SectionName } from "./index"

type SectionValues = Record<string, unknown>

const isPlainObject = (value: unknown): value is SectionValues =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/**
 * A stored section as values to use. Fields the schema no longer knows are
 * dropped; a field that no longer passes (a token or option removed in a
 * deploy) falls back to its default on its own, logged, rather than taking
 * the whole section back to defaults or failing every read.
 */
export function parseStored(name: SectionName, stored: unknown): SectionValues {
  const section = sectionOf(name)
  const known = Object.keys(section.defaults)
  const kept = isPlainObject(stored)
    ? Object.fromEntries(Object.entries(stored).filter(([key]) => known.includes(key)))
    : {}
  const whole = section.full.safeParse(mergePatch(section.defaults, kept))
  if (whole.success) {
    return whole.data
  }
  const values: SectionValues = { ...section.defaults }
  const dropped: string[] = []
  for (const [key, value] of Object.entries(kept)) {
    const alone = section.full.safeParse(mergePatch(section.defaults, { [key]: value }))
    if (alone.success) {
      values[key] = alone.data[key]
    } else {
      dropped.push(key)
    }
  }
  logger.error({ event: "platform_settings.section_invalid", section: name, fields: dropped })
  return values
}

/** A ZodError from a section schema as a ValidationError carrying its first issue's key. */
export function toValidationError(error: unknown): unknown {
  const issues = (error as { issues?: { message?: string; path?: PropertyKey[] }[] }).issues
  const issue = issues?.[0]
  if (!issue) {
    return error
  }
  const key =
    issue.message && /^[a-z_]+\.[a-z_]+$/.test(issue.message)
      ? issue.message
      : "platform_settings.invalid"
  return new ValidationError(key, { field: (issue.path ?? []).map(String).join(".") })
}
