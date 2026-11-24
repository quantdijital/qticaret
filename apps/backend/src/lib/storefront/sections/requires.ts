/**
 * Sections that need a feature flag (adr/0077 §8). Mirrors
 * `@qticaret/types`' `section-requires.ts` (the backend reads no runtime
 * value from that package); a unit test keeps them equal. A flagged
 * section the shop saved is kept and its save never refused; while its
 * flag is off the design given to the storefront leaves it out
 * (`layout-read.ts`), and a ready-made look applying one drops it as
 * `feature_off` (`presets/resolve.ts`).
 */

export const CAPABILITY_GROUPS = {
  // Products sold by departure (adr/0076): "Tarihli ürünler"
  dated: {
    flag: "catalog.booking",
    feature: "booking",
    label: "storefront.editor.capabilities.dated",
  },
} as const

export type CapabilityFlag = (typeof CAPABILITY_GROUPS)[keyof typeof CAPABILITY_GROUPS]["flag"]

/** Section type → the flag it needs: upcoming departures (adr/0077 §10), a dated product's program (adr/0078). */
export const SECTION_REQUIRES: Readonly<Record<string, CapabilityFlag>> = {
  departures: "catalog.booking",
  program: "catalog.booking",
}

/** Section types → their flags, as a design's checks read them (tests pass their own). */
export type SectionRequires = Readonly<Record<string, string>>

/** The flag a section type needs, else null. */
export const requiredFlag = (type: string, requires: SectionRequires = SECTION_REQUIRES) =>
  Object.hasOwn(requires, type) ? (requires[type] ?? null) : null

/** Every flag some section needs, once each. */
export const requiredFlags = (requires: SectionRequires = SECTION_REQUIRES): string[] => [
  ...new Set(Object.values(requires)),
]

/**
 * The section types whose flag is off, each with its flag; read once per
 * design, only the flags a section needs (none while the list is empty).
 */
export async function typesOff(
  isEnabled: (flag: string) => Promise<boolean>,
  requires: SectionRequires = SECTION_REQUIRES
): Promise<Map<string, string>> {
  const flags = requiredFlags(requires)
  const on = await Promise.all(flags.map((flag) => isEnabled(flag)))
  const off = new Set(flags.filter((_, index) => !on[index]))
  return new Map(Object.entries(requires).filter(([, flag]) => off.has(flag)))
}

/** The sections that may show: a type whose flag is off is left out (`typesOff`). */
export const withoutTypesOff = <S extends { type: string }>(
  sections: readonly S[],
  off: ReadonlyMap<string, string>
): S[] => (off.size === 0 ? [...sections] : sections.filter((section) => !off.has(section.type)))
