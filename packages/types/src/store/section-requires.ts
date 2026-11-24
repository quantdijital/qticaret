/**
 * Sections that need a feature flag (adr/0077 §8): a section type the shop
 * may lay out only while the capability it draws is on, ör. a dated
 * product's departures (`catalog.booking`). While the flag is off the
 * panel's "Bölüm ekle" does not offer it, the backend leaves it out of the
 * design it gives the storefront and the storefront checks again; a saved
 * one is kept (the save is never refused) and marked "kapalı" in the
 * panel's tree, so turning the flag back on brings everything back. A
 * ready-made look applying one drops it (`feature_off`); a sector pack
 * whose flags do not turn the flag on may not ship a look using it.
 *
 * The contract's list: the backend mirrors it (`lib/storefront/sections/
 * requires.ts`, a test keeps them equal), as does the sector pack loader.
 * Holds no imports: the mirrors' tests read this file as it is.
 */

/**
 * The capabilities a flagged section belongs to: the panel's chooser
 * groups them under the capability's name (`label`, an i18n key), the
 * storefront reads the flag as `GET /store/storefront`'s `features[feature]`.
 */
export const CAPABILITY_GROUPS = {
  /** Products sold by departure (adr/0076): "Tarihli ürünler". */
  dated: {
    flag: "catalog.booking",
    feature: "booking",
    label: "storefront.editor.capabilities.dated",
  },
} as const

export type Capability = keyof typeof CAPABILITY_GROUPS

/** A flag a section may need: one of the capabilities'. */
export type CapabilityFlag = (typeof CAPABILITY_GROUPS)[Capability]["flag"]

/** `GET /store/storefront`'s name for a capability's flag. */
export type CapabilityFeature = (typeof CAPABILITY_GROUPS)[Capability]["feature"]

/**
 * Section type → the flag it needs; a type not here needs none. The first:
 * upcoming departures (adr/0077 §10), a dated product's.
 */
export const SECTION_REQUIRES: Readonly<Record<string, CapabilityFlag>> = {
  departures: "catalog.booking",
}

/** The flag a section type needs, else null. */
export function requiredFlag(
  type: string,
  requires: Readonly<Record<string, string>> = SECTION_REQUIRES
): string | null {
  return Object.hasOwn(requires, type) ? (requires[type] ?? null) : null
}

/** The capability whose flag this is, else null. */
export function capabilityOfFlag(flag: string): Capability | null {
  const found = (Object.keys(CAPABILITY_GROUPS) as Capability[]).find(
    (capability) => CAPABILITY_GROUPS[capability].flag === flag
  )
  return found ?? null
}

/** The capability a section type belongs to, else null (a section every shop may lay out). */
export function capabilityOf(
  type: string,
  requires: Readonly<Record<string, string>> = SECTION_REQUIRES
): Capability | null {
  const flag = requiredFlag(type, requires)
  return flag === null ? null : capabilityOfFlag(flag)
}

/**
 * Whether a section of this type may show: it needs no flag, or its flag
 * is on (`isOn`). A flag no capability names is read as off.
 */
export function sectionAllowed(
  type: string,
  isOn: (flag: string) => boolean,
  requires: Readonly<Record<string, string>> = SECTION_REQUIRES
): boolean {
  const flag = requiredFlag(type, requires)
  return flag === null || isOn(flag)
}

/**
 * A flag as `GET /store/storefront`'s `features` says it: on only when the
 * capability's field is `true` (an older backend without it: off).
 */
export const storefrontFlagOn =
  (features: Readonly<Partial<Record<string, boolean>>> | undefined) =>
  (flag: string): boolean => {
    const capability = capabilityOfFlag(flag)
    return capability !== null && features?.[CAPABILITY_GROUPS[capability].feature] === true
  }
