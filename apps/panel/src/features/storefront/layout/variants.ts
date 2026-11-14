import { hasVariants } from "@qticaret/types"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"

/** A section whose type is drawn more than one way (adr/0049 Ek 2026-11-14 §2). */
export type VariantSection = Extract<AnySection, { type: VariantSectionType }>

/**
 * Each variant's own fields as a section switched to it starts them; what
 * is common to the type (title, text, buttons, picture) is not here and
 * stays as written. A variant with no fields of its own has none.
 */
export const VARIANT_FIELDS: {
  readonly [T in VariantSectionType]: Readonly<Record<SectionVariant<T>, Readonly<object>>>
} = {
  trust_badges: { strip: {}, lined: {} },
}

/** Whether the panel offers the section's "Biçim": its type is drawn more than one way. */
export const offersVariants = (section: AnySection): section is VariantSection =>
  hasVariants(section.type) && "variant" in section

/**
 * The section drawn another way (§2.4, option B): its common fields carried
 * over, its old variant's own fields dropped and the new one's started from
 * their defaults. One step in the editor's history, so "Geri al" brings the
 * old variant back with what was written in it.
 */
export function switchVariant<S extends VariantSection>(
  section: S,
  next: SectionVariant<S["type"]>
): S {
  const fields: Readonly<Record<string, object>> = VARIANT_FIELDS[section.type]
  const own = new Set(Object.keys(fields[section.variant] ?? {}))
  const kept = Object.fromEntries(Object.entries(section).filter(([key]) => !own.has(key)))
  return { ...kept, ...structuredClone(fields[next] ?? {}), variant: next } as S
}
