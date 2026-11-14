import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import { TRUST_BADGES_BRANCHES } from "./trust-badges"
import { REMOVED_VARIANTS, SECTION_VARIANTS, isVariantType } from "./variants"
import type { SectionVariant, VariantBranch, VariantSectionType } from "./variants"

/** Each type's variants' branches: what a section read as that variant keeps. */
const BRANCHES: {
  readonly [T in VariantSectionType]: Readonly<Record<SectionVariant<T>, VariantBranch>>
} = {
  trust_badges: TRUST_BADGES_BRANCHES,
}

/** Kept whatever the branch: a category page's section's place. */
const ALWAYS_KEPT = ["placement"]

/**
 * A stored section as today's lists read it (adr/0049 Ek 2026-11-14 §2.3,
 * forgiving on reading): a variant off its type's list (taken off since,
 * or written by a newer build) reads as the one that replaced it, else as
 * the default, keeping only the fields that variant has, so the design
 * still reads. No variant at all is the default's to fill (the schema).
 * A save is still held to the list.
 */
export function storedSection(section: unknown): unknown {
  const type = isPlainObject(section) ? section["type"] : undefined
  if (!isPlainObject(section) || !isVariantType(type)) {
    return section
  }
  const listed: readonly string[] = SECTION_VARIANTS[type]
  const variant = section["variant"]
  if (variant === undefined || (typeof variant === "string" && listed.includes(variant))) {
    return section
  }
  const removed: Readonly<Record<string, string>> = REMOVED_VARIANTS[type] ?? {}
  const to = ((typeof variant === "string" ? removed[variant] : undefined) ??
    SECTION_VARIANTS[type][0]) as SectionVariant<typeof type>
  const keeps = new Set([...Object.keys(BRANCHES[type][to].shape), ...ALWAYS_KEPT])
  return {
    ...Object.fromEntries(Object.entries(section).filter(([key]) => keeps.has(key))),
    variant: to,
  }
}
