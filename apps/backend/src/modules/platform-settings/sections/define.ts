import { z } from "@medusajs/framework/zod"

/**
 * A settings section: its fields, the defaults a tenant starts from, and
 * the schemas built from them. `full` checks stored values; `patch` checks
 * what the admin sends (any subset of fields, nested objects partial too).
 * Unknown fields are refused by both.
 */
export interface SectionDefinition<T extends object> {
  name: string
  defaults: T
  full: z.ZodType<T>
  patch: z.ZodType<Partial<Record<keyof T, unknown>>>
}

type Fields = Record<string, z.ZodType>

export function defineSection<T extends object>(
  name: string,
  fields: Fields,
  defaults: T,
  refine?: (values: T, ctx: z.RefinementCtx) => void
): SectionDefinition<T> {
  const base = z.object(fields).strict()
  const full = (refine
    ? base.superRefine((values, ctx) => {
        refine(values as T, ctx)
      })
    : base) as unknown as z.ZodType<T>
  const patchFields = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      (field instanceof z.ZodObject ? field.partial() : field).optional(),
    ])
  )
  const patch = z.object(patchFields).strict() as unknown as z.ZodType<
    Partial<Record<keyof T, unknown>>
  >
  return { name, defaults, full, patch }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** `patch` over `current`, one level deep: a nested object keeps the fields the patch leaves out. */
export function mergePatch(current: object, patch: object): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue
    }
    const existing = merged[key]
    merged[key] =
      isPlainObject(existing) && isPlainObject(value) ? { ...existing, ...value } : value
  }
  return merged
}

/**
 * Text a setting may hold: no control characters (tab only where allowed)
 * and no lone surrogates, which Postgres jsonb refuses and which have no
 * place in titles, hosts or robots.txt that later reach pages and headers.
 */
export function isCleanText(text: string, allowTab = false): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f)
    const loneSurrogate = code >= 0xd800 && code <= 0xdfff
    if ((control && !(allowTab && code === 0x09)) || loneSurrogate) {
      return false
    }
  }
  return true
}
