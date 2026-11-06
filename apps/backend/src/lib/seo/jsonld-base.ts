/** One structured data block, as JSON (docs/13 §5). */
export type JsonLd = Record<string, unknown>

export const SCHEMA = "https://schema.org"

/** The block without empty values: null, undefined, "" and empty lists. */
export const compact = (block: JsonLd): JsonLd =>
  Object.fromEntries(
    Object.entries(block).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0)
    )
  )
