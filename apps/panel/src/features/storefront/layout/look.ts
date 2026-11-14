import { SECTION_LOOK, SECTION_LOOK_FIELDS } from "@qticaret/types"
import type { SectionLook, SectionLookField, SectionLookStep } from "@qticaret/types"
import type { BodySection, BodySectionType } from "@/features/storefront/api/layout"

/**
 * A section's look in the panel (adr/0049 Ek 2026-11-14 §6): which of the
 * five fields a section's type offers, which steps, and the section with
 * one step changed. The lists are the contract's (`SECTION_LOOK`); the
 * schema still takes every field on every body section, the theme leaves
 * unread what means nothing there.
 */

/** Types whose heading and text sit on their own picture or have none: alignment means nothing. */
const NO_ALIGN: ReadonlySet<BodySectionType> = new Set([
  "hero",
  "hero_slider",
  "banner",
  "trust_badges",
])

/**
 * Types carrying long text: the shop's colour holds its foreground only for
 * large text and controls (adr/0062 §6, 3:1), so it is not offered there.
 */
const LONG_TEXT: ReadonlySet<BodySectionType> = new Set(["rich_text", "faq"])

/**
 * Types that offer only some of the look: a scrolling strip has its own
 * ground and a height set by its size, and no heading to align (adr/0049
 * Ek 2026-11-14 §4.1, §6); the space above it and its width stay.
 */
const ONLY: Partial<Record<BodySectionType, readonly SectionLookField[]>> = {
  marquee: ["space_outer", "width"],
}

/** The look's fields the panel offers for a type, in the contract's order. */
export const lookFieldsFor = (type: BodySectionType): readonly SectionLookField[] =>
  SECTION_LOOK_FIELDS.filter(
    (field) => (ONLY[type]?.includes(field) ?? true) && (field !== "align" || !NO_ALIGN.has(type))
  )

/** A field's steps the panel offers for a type. */
export function lookStepsFor<F extends SectionLookField>(
  type: BodySectionType,
  field: F
): readonly SectionLookStep<F>[] {
  const steps: readonly SectionLookStep<F>[] = SECTION_LOOK[field]
  return field === "ground" && LONG_TEXT.has(type)
    ? steps.filter((step) => step !== "primary")
    : steps
}

const NONE: SectionLook = {
  space_outer: null,
  space_inner: null,
  ground: null,
  align: null,
  width: null,
}

/** A field's step as the section has it; `null`: the theme's own. */
export const lookStep = <F extends SectionLookField>(
  section: BodySection,
  field: F
): SectionLook[F] => section.look?.[field] ?? null

/**
 * The section with one field's step changed; `null` puts the theme's own
 * back. With no step left the look goes, so a section put back to the
 * theme's own is the document it was before (nothing left to save).
 */
export function withLookStep<S extends BodySection, F extends SectionLookField>(
  section: S,
  field: F,
  step: SectionLook[F]
): S {
  const look: SectionLook = { ...NONE, ...section.look, [field]: step }
  if (Object.values(look).some((value) => value !== null)) {
    return { ...section, look }
  }
  const rest = { ...section }
  delete rest.look
  return rest
}

/** How many of the type's offered fields the shop set: the closed group says so. */
export const lookCount = (section: BodySection): number =>
  lookFieldsFor(section.type).filter((field) => lookStep(section, field) !== null).length
