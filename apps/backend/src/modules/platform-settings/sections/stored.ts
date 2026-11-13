import { validationErrorFromZod } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { isPlainObject, mergePatch } from "./define"
import { sectionOf } from "./index"
import type { SectionName } from "./index"

type SectionValues = Record<string, unknown>

/**
 * A stored section as values to use. Fields the schema no longer knows are
 * dropped; a field that no longer passes (a token or option removed in a
 * deploy) falls back to its default on its own, logged, rather than taking
 * the whole section back to defaults or failing every read. A section's
 * `upgrade` reads a row written under its older meaning first (adr/0062 §4).
 */
export function parseStored(name: SectionName, stored: unknown): SectionValues {
  const section = sectionOf(name)
  const known = Object.keys(section.defaults)
  const current = isPlainObject(stored) ? (section.upgrade?.(stored) ?? stored) : {}
  const kept = Object.fromEntries(Object.entries(current).filter(([key]) => known.includes(key)))
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
export const toValidationError = (error: unknown): unknown =>
  validationErrorFromZod(error, "platform_settings.invalid")
