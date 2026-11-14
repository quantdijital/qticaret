import { SECTION_VARIANTS, defaultVariant } from "@qticaret/types/section-variants"
import type { DefaultVariant, SectionVariant, VariantSectionType } from "@qticaret/types"

/**
 * Section variants in the theme contract (adr/0049 Ek 2026-11-14 §2): the
 * lists are `@qticaret/types`' (the backend's schema mirrors them); a
 * section's view carries its variant, and a theme draws the ones it has.
 *
 * Values come from the `section-variants` subpath, never the package root:
 * the root re-exports through `./x.js` specifiers, which Turbopack (the
 * storefront's dev server) cannot resolve to `.ts` source. Type imports
 * are erased and may name the root (`storefront-imports.spec.ts` guards it).
 */
export {
  SECTION_VARIANTS,
  defaultVariant,
  hasVariants,
  variantOf,
} from "@qticaret/types/section-variants"
export type {
  DefaultVariant,
  SectionVariant,
  TrustBadgesVariant,
  VariantSectionType,
} from "@qticaret/types"

/**
 * The variant a theme draws for a section (§2.3, forgiving on reading):
 * the section's own when the theme draws it, else the type's default, its
 * fields of that variant left unread. A theme names what it draws, so a
 * variant added to the contract before the theme draws it (or one an older
 * theme build never knew) still shows, as the default.
 */
export function drawnVariant<T extends VariantSectionType, D extends SectionVariant<T>>(
  type: T,
  variant: unknown,
  drawn: readonly D[]
): D | DefaultVariant<T> {
  const known: readonly unknown[] = drawn
  return known.includes(variant) && SECTION_VARIANTS[type].some((each) => each === variant)
    ? (variant as D)
    : defaultVariant(type)
}
