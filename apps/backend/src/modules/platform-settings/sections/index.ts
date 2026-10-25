import type { SectionDefinition } from "./define"
import { seoSection } from "./seo"
import { storeSection } from "./store"

export { DEFAULT_ROBOTS_TXT } from "./seo"
export type { SeoSettings } from "./seo"
export type { StoreSettings } from "./store"
export { mergePatch } from "./define"
export type { SectionDefinition } from "./define"

export const SECTIONS = { store: storeSection, seo: seoSection } as const

export type SectionName = keyof typeof SECTIONS

// Own keys only: `in` would also accept "toString" and "__proto__"
export const isSectionName = (value: string): value is SectionName => Object.hasOwn(SECTIONS, value)

export const sectionOf = (name: SectionName): SectionDefinition<Record<string, unknown>> =>
  SECTIONS[name] as unknown as SectionDefinition<Record<string, unknown>>
