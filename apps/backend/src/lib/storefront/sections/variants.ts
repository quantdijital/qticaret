import { z } from "@medusajs/framework/zod"

/**
 * Section variants (adr/0049 Ek 2026-11-14 §2): a closed list per section
 * type, its first the drawing from before variants and the default. A
 * section stored without `variant` reads as the default (no migration, no
 * "unsaved changes"); a save naming one off the list is refused as a
 * section not recognised. Each variant is its own branch of the type's
 * union (owner's decision 1, option B): what is common to the type sits in
 * every branch under the same name, what is the variant's only in its own.
 *
 * Mirrors `@qticaret/types`' `SECTION_VARIANTS` (the backend reads no
 * runtime value from that package); a unit test keeps them equal. A new
 * variant goes into the contract first, then here, then into the theme.
 */
export const SECTION_VARIANTS = {
  trust_badges: ["strip", "lined"],
  // H17: the category list, the opening's tile and two category tiles side by side
  hero: ["standard", "category_list"],
  // The main sections (adr/0049 Ek 2026-11-14 §5, §7): today's drawing first.
  // `centered` is the theme setting's centred header (`header.layout`), read
  // into the bar; its drawing stays on adr/0062 karar 6's branch
  header_bar: ["standard", "centered"],
  footer_bar: ["ledger"],
  product_main: ["standard"],
  category_main: ["standard"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type VariantSectionType = keyof typeof SECTION_VARIANTS
export type SectionVariant<T extends VariantSectionType> = (typeof SECTION_VARIANTS)[T][number]

/**
 * A variant taken off its list, read as the one that took its place
 * (`REMOVED_THEMES`' pattern) so a stored design never stops reading; one
 * not named here reads as the type's default. None yet.
 */
export const REMOVED_VARIANTS: {
  readonly [T in VariantSectionType]?: Readonly<Record<string, SectionVariant<T>>>
} = {}

/** A variant off the list: a stale or forged editor, as a `columns` count off its list is. */
export const VARIANT_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * The default branch's discriminator: the type's first variant, taken when
 * the section has none, before the union picks a branch (Zod 4 nests a
 * discriminated union in another; a `preprocess` there does not, so the
 * default sits on the literal).
 */
export const defaultVariant = <T extends VariantSectionType>(type: T) => {
  const first: (typeof SECTION_VARIANTS)[T][0] = SECTION_VARIANTS[type][0]
  return z.literal(first).default(first)
}

/** What the reading needs of a branch: the fields a section read as it may keep. */
export interface VariantBranch {
  shape: Record<string, unknown>
}

export const isVariantType = (type: unknown): type is VariantSectionType =>
  typeof type === "string" && Object.hasOwn(SECTION_VARIANTS, type)
