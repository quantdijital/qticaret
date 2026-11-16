import { SECTION_LOOK, SECTION_LOOK_FIELDS } from "@qticaret/types"
import type { SectionLook, SectionLookField, SectionLookStep } from "@qticaret/types"
import type { LookedSection } from "@/features/storefront/api/layout"

type LookedType = LookedSection["type"]

/**
 * A section's look in the panel (adr/0049 Ek 2026-11-14 §6): which of the
 * five fields a section's type offers, which steps, and the section with
 * one step changed. The lists are the contract's (`SECTION_LOOK`); the
 * schema still takes every field on every body section, the theme leaves
 * unread what means nothing there.
 */

/** Types whose heading and text sit on their own picture or have none: alignment means nothing. */
const NO_ALIGN: ReadonlySet<LookedType> = new Set(["hero", "hero_slider", "banner", "trust_badges"])

/**
 * Types carrying long text: the shop's colour holds its foreground only for
 * large text and controls (adr/0062 §6, 3:1), so it is not offered there.
 */
const LONG_TEXT: ReadonlySet<LookedType> = new Set(["rich_text", "faq"])

/**
 * Types that offer only some of the look: a scrolling strip has its own
 * ground and a height set by its size, and no heading to align (adr/0049
 * Ek 2026-11-14 §4.1, §6); the space above it and its width stay.
 */
const ONLY: Partial<Record<LookedType, readonly SectionLookField[]>> = {
  marquee: ["space_outer", "space_below", "width"],
  // The page's main block keeps its own grounds and inner spacing (adr/0049 Ek 2026-11-14 §7)
  product_main: ["space_outer", "space_below", "width"],
  category_main: ["space_outer", "space_below", "width"],
}

/**
 * Types with a width of their own (the band's "Kutulu / Tam", adr/0049 Ek
 * 2026-11-14 §3.3 E2): the look's width is not offered beside it.
 */
const OWN_WIDTH: ReadonlySet<LookedType> = new Set(["banner", "strip_gallery"])

/**
 * The space above and below a section, in their own open "Boşluk" group
 * (sahip 2026-11-15: every section's spacing within reach); the rest of
 * the look stays in the closed "Diğer ayarlar".
 */
export const SPACING_FIELDS: readonly SectionLookField[] = ["space_outer", "space_below"]

/** Which group a field sits in: `spacing` ("Boşluk") or `other` ("Diğer ayarlar"); none: both. */
export type LookPart = "spacing" | "other"

const inPart = (field: SectionLookField, part: LookPart | undefined) =>
  part === undefined || SPACING_FIELDS.includes(field) === (part === "spacing")

/** The look's fields the panel offers for a type, in the contract's order (only one group's, with `part`). */
export const lookFieldsFor = (type: LookedType, part?: LookPart): readonly SectionLookField[] =>
  SECTION_LOOK_FIELDS.filter(
    (field) =>
      inPart(field, part) &&
      (ONLY[type]?.includes(field) ?? true) &&
      (field !== "align" || !NO_ALIGN.has(type)) &&
      (field !== "width" || !OWN_WIDTH.has(type))
  )

/** A field's steps the panel offers for a type. */
export function lookStepsFor<F extends SectionLookField>(
  type: LookedType,
  field: F
): readonly SectionLookStep<F>[] {
  const steps: readonly SectionLookStep<F>[] = SECTION_LOOK[field]
  return field === "ground" && LONG_TEXT.has(type)
    ? steps.filter((step) => step !== "primary")
    : steps
}

const NONE: SectionLook = {
  space_outer: null,
  space_below: null,
  space_inner: null,
  ground: null,
  align: null,
  width: null,
}

/** A field's step as the section has it; `null`: the theme's own. */
export const lookStep = <F extends SectionLookField>(
  section: LookedSection,
  field: F
): SectionLook[F] => section.look?.[field] ?? null

/**
 * The section with one field's step changed; `null` puts the theme's own
 * back. With no step left the look goes, so a section put back to the
 * theme's own is the document it was before (nothing left to save).
 */
export function withLookStep<S extends LookedSection, F extends SectionLookField>(
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

/** How many of the type's offered fields the shop set (in one group, with `part`): the group's title says so. */
export const lookCount = (section: LookedSection, part?: LookPart): number =>
  lookFieldsFor(section.type, part).filter((field) => lookStep(section, field) !== null).length
