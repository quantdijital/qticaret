/**
 * A section's look (adr/0049 Ek 2026-11-14 §6): named steps for the space
 * around and inside a section, its ground, how its heading and text line
 * up and how wide it stands; never a number or a colour, the theme maps
 * each step onto its own scale. The contract's list: a new step goes here
 * first, then into the backend's schema (`lib/storefront/sections/
 * look.ts`, a mirror a test keeps equal), then into the themes. `null` (or
 * no `look`) is the theme's own drawing. The panel's Turkish names are
 * `storefront.editor.look.<field>.<step>`.
 */
export const SECTION_LOOK = {
  /** Above the section (margin): none, then the theme's small, medium and large section gaps. */
  space_outer: ["none", "small", "medium", "large"],
  /** Inside it (padding), from the theme's spacing scale. */
  space_inner: ["none", "small", "medium", "large"],
  /** Its ground: the page's, a tinted well, the dark stage, the shop's own colour; pairs the theme measured. */
  ground: ["page", "well", "stage", "primary"],
  /** Its heading and text block. */
  align: ["start", "center"],
  /** A reading measure, the theme's container, or edge to edge. */
  width: ["narrow", "boxed", "full"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type SectionLookField = keyof typeof SECTION_LOOK
export type SectionLookStep<F extends SectionLookField> = (typeof SECTION_LOOK)[F][number]

/** The look as the design keeps it: every field present, `null` the theme's own. */
export type SectionLook = { [F in SectionLookField]: SectionLookStep<F> | null }

/** The fields in the order the panel offers them. */
export const SECTION_LOOK_FIELDS = Object.keys(SECTION_LOOK) as SectionLookField[]

const isLookField = (field: string): field is SectionLookField => Object.hasOwn(SECTION_LOOK, field)

/**
 * A section's look as a reader takes it (forgiving on reading, §2.3): only
 * the steps this build knows, the rest (none, a newer backend's, another
 * shape) left to the theme. None at all is an empty object.
 */
export function lookOf(look: unknown): Partial<SectionLook> {
  if (look === null || typeof look !== "object" || Array.isArray(look)) {
    return {}
  }
  const known = Object.entries(look).filter(
    ([field, step]) =>
      isLookField(field) && (SECTION_LOOK[field] as readonly unknown[]).includes(step)
  )
  return Object.fromEntries(known)
}
