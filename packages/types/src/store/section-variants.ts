/**
 * Section variants (adr/0049 Ek 2026-11-14 §2): how a section type may be
 * drawn, a closed list per type whose first is the drawing from before
 * variants and the default. The contract's list: a new variant goes here
 * first, then into the backend's schema (`lib/storefront/sections/
 * variants.ts`, a mirror a test keeps equal), then into the themes. Names
 * are English, sector-free and say what is drawn; the panel's Turkish
 * names are `storefront.editor.variants.<type>.<variant>`.
 */
export const SECTION_VARIANTS = {
  /** `strip`: today's tinted strip; `lined`: boxes split by hairlines (GB4). */
  trust_badges: ["strip", "lined"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type VariantSectionType = keyof typeof SECTION_VARIANTS
export type SectionVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][number]
export type DefaultVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][0]

export type TrustBadgesVariant = SectionVariant<"trust_badges">

export const isVariantType = (type: string): type is VariantSectionType =>
  Object.hasOwn(SECTION_VARIANTS, type)

/** The type's default variant: what a section without one, or with one not known here, is. */
export const defaultVariant = <T extends VariantSectionType>(type: T): DefaultVariant<T> =>
  SECTION_VARIANTS[type][0]

/** Whether the type offers a choice: the panel shows its "Biçim" only then. */
export function hasVariants(type: string): type is VariantSectionType {
  if (!isVariantType(type)) {
    return false
  }
  // A type keeps its list when a variant is taken off, so one may be left
  const listed: readonly string[] = SECTION_VARIANTS[type]
  return listed.length > 1
}

/**
 * A section's variant as a reader takes it (forgiving on reading, §2.3):
 * one on the type's list as it is; none, or one this build does not know
 * (a newer backend's), the type's default.
 */
export function variantOf<T extends VariantSectionType>(
  type: T,
  variant: unknown
): SectionVariant<T> {
  const listed: readonly unknown[] = SECTION_VARIANTS[type]
  return listed.includes(variant) ? (variant as SectionVariant<T>) : defaultVariant(type)
}
