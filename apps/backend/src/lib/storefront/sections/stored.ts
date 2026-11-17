import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import { storedFooterRows } from "./footer-rows-stored"
import { storedLook } from "./look"
import { MAIN_BRANCHES, storedByVariant, storedMenuImages } from "./main"
import { PRODUCTS_BRANCHES, storedCardVariant } from "./products"
import { CATEGORIES_BRANCHES } from "./categories"
import { RELATED_BRANCHES } from "./related-products"
import { HERO_BRANCHES } from "./hero"
import { TRUST_BADGES_BRANCHES } from "./trust-badges"
import { NEWSLETTER_BRANCHES } from "./newsletter"
import { REMOVED_VARIANTS, SECTION_VARIANTS, isVariantType } from "./variants"
import type { SectionVariant, VariantBranch, VariantSectionType } from "./variants"

/** Each type's variants' branches: what a section read as that variant keeps. */
const BRANCHES: {
  readonly [T in VariantSectionType]: Readonly<Record<SectionVariant<T>, VariantBranch>>
} = {
  trust_badges: TRUST_BADGES_BRANCHES,
  hero: HERO_BRANCHES,
  categories: CATEGORIES_BRANCHES,
  products: PRODUCTS_BRANCHES,
  related_products: RELATED_BRANCHES,
  newsletter: NEWSLETTER_BRANCHES,
  ...MAIN_BRANCHES,
}

/** Kept whatever the branch: a category page's section's place. */
const ALWAYS_KEPT = ["placement"]

/**
 * A stored section as today's lists read it (adr/0049 Ek 2026-11-14 §2.3,
 * forgiving on reading): a variant off its type's list (taken off since,
 * or written by a newer build) reads as the one that replaced it, else as
 * the default, keeping only the fields that variant has, so the design
 * still reads; a look's step off its list is dropped (`storedLook`), and
 * so is a category grid's settings of a variant off its list
 * (`storedByVariant`), a product rail's card variant off its list too
 * (`storedCardVariant`), a header bar's menus' pictures or the catalog
 * header's layout choices off their lists (`storedMenuImages`), a free rows
 * footer's blocks today's schema does not read or its bounds do not take
 * (`storedFooterRows`). No variant at all is the default's to fill (the schema). A save is still
 * held to the lists.
 */
export function storedSection(stored: unknown): unknown {
  if (!isPlainObject(stored)) {
    return stored
  }
  const section = storedFooterRows(
    storedMenuImages(storedCardVariant(storedByVariant(storedLook(stored))))
  )
  const type = section["type"]
  if (!isVariantType(type)) {
    return section
  }
  const listed: readonly string[] = SECTION_VARIANTS[type]
  const variant = section["variant"]
  if (variant === undefined || (typeof variant === "string" && listed.includes(variant))) {
    return section
  }
  const removed: Readonly<Record<string, string>> = REMOVED_VARIANTS[type] ?? {}
  const to: string =
    (typeof variant === "string" ? removed[variant] : undefined) ?? SECTION_VARIANTS[type][0]
  const branches: Readonly<Record<string, VariantBranch>> = BRANCHES[type]
  const keeps = new Set([...Object.keys(branches[to]?.shape ?? {}), ...ALWAYS_KEPT])
  return {
    ...Object.fromEntries(Object.entries(section).filter(([key]) => keeps.has(key))),
    variant: to,
  }
}
