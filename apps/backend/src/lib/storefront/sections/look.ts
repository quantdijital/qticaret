import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import { base, device } from "../layout-fields"

/**
 * A section's look (adr/0049 Ek 2026-11-14 §6): the space around it and
 * inside it, its ground, how its heading and text line up and how wide it
 * stands. Every field is a closed list of named steps, never a number or a
 * colour: the theme maps each step onto its own scale (`--section-gap-*`,
 * `--space-*`, its measured grounds, `--container`). None (`null`, or no
 * `look` at all) is the theme's own drawing, so a design saved before looks
 * reads as it did and nothing is migrated.
 *
 * Every body section takes it (the main sections will, adr/0049 §9 V3);
 * the header's bar and the footer's box do not. A field that means nothing
 * in a section (a marquee's alignment) is still accepted and left unread by
 * the theme; the panel just does not offer it.
 *
 * Mirrors `@qticaret/types`' `SECTION_LOOK` (the backend reads no runtime
 * value from that package); a unit test keeps them equal.
 */
export const SECTION_LOOK = {
  space_outer: ["none", "small", "medium", "large"],
  space_below: ["none", "small", "medium", "large"],
  space_inner: ["none", "small", "medium", "large"],
  ground: ["page", "well", "stage", "primary"],
  align: ["start", "center"],
  width: ["narrow", "boxed", "full"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type LookField = keyof typeof SECTION_LOOK
export type LookValue<F extends LookField> = (typeof SECTION_LOOK)[F][number]

const LOOK_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * A field's steps: a value off the list is refused with the error key (a
 * custom check, as Medusa's answer reads an enum's or a literal union's
 * issue as a missing field and drops the key).
 */
const step = <F extends LookField>(field: F) => {
  const steps: readonly unknown[] = SECTION_LOOK[field]
  return z
    .custom<LookValue<F>>((value) => steps.includes(value), LOOK_ERROR)
    .nullable()
    .default(null)
}

/** A value off a field's list is a stale or forged editor, as a `columns` count off its list is. */
export const sectionLook = z
  .object({
    space_outer: step("space_outer"),
    space_below: step("space_below"),
    space_inner: step("space_inner"),
    ground: step("ground"),
    align: step("align"),
    width: step("width"),
  })
  .strict()

export type SectionLook = z.infer<typeof sectionLook>

/** What every body section is made of: the settings every section has, the screens it shows on, and its look. */
export const bodyFields = { ...base, device, look: sectionLook.optional() }

const isLookField = (key: string): key is LookField => Object.hasOwn(SECTION_LOOK, key)

/**
 * A stored section's look as today's lists read it (adr/0049 Ek 2026-11-14
 * §2.3, forgiving on reading): a step taken off a list since, or a field a
 * newer build wrote, is dropped, so the theme draws its own there and the
 * design still reads; a look that is not an object is left out. A save is
 * still held to the lists.
 */
export function storedLook(section: Record<string, unknown>): Record<string, unknown> {
  if (!("look" in section)) {
    return section
  }
  const { look, ...rest } = section
  if (!isPlainObject(look)) {
    return rest
  }
  const kept = Object.entries(look).filter(
    ([field, value]) =>
      isLookField(field) &&
      (value === null || (SECTION_LOOK[field] as readonly unknown[]).includes(value))
  )
  return kept.length === Object.keys(look).length
    ? section
    : { ...rest, look: Object.fromEntries(kept) }
}

/** Whether the shop set any step: else the section is the theme's own and no `look` is printed. */
export const hasLook = (look: SectionLook | undefined): look is SectionLook =>
  look !== undefined && Object.values(look).some((value) => value !== null)
