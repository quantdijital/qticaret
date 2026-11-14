import { z } from "@medusajs/framework/zod"
import {
  LAYOUT_LIMITS,
  announcementBar,
  categorySection,
  pageSection,
  productSection,
  worded,
} from "./layout-sections"
import type { BodySection } from "./layout-sections"
import { layoutSettings, storedSettings } from "./layout-settings"
import { storedSection } from "./sections/stored"

/**
 * The storefront's design as the theme editor writes it (adr/0049): the
 * header's, the home page's, the product and category pages' and the
 * footer's sections (`layout-sections.ts`), and the theme's shared
 * settings (`layout-settings.ts`), checked as one document.
 */

export { LAYOUT_LIMITS } from "./layout-sections"
export type {
  BodySection,
  CategorySection,
  FooterSection,
  HeaderSection,
  LayoutSection,
  PageSection,
  ProductSection,
} from "./layout-sections"

const onlyOnce = (sections: readonly { type: string }[]) =>
  new Set(sections.map((section) => section.type)).size === sections.length

/** The whole design: checked as one, so a section's id is unique across the groups. */
export const layoutDocument = z
  .object({
    header: z.array(announcementBar).max(LAYOUT_LIMITS.header).default([]),
    home: z.array(pageSection).max(LAYOUT_LIMITS.home).default([]),
    footer: z.array(worded("newsletter")).max(LAYOUT_LIMITS.footer).default([]),
    product: z.array(productSection).max(LAYOUT_LIMITS.product).default([]),
    category: z.array(categorySection).max(LAYOUT_LIMITS.category).default([]),
    /** What several pages draw alike: trust badges, colour swatches, "Az kaldı". */
    settings: layoutSettings,
  })
  .strict()
  .superRefine((doc, ctx) => {
    const all: { id: string; starts_at: string | null; ends_at: string | null }[] = [
      ...doc.header,
      ...doc.home,
      ...doc.footer,
      ...doc.product,
      ...doc.category,
    ]
    if (new Set(all.map((section) => section.id)).size !== all.length) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.section_duplicate" })
    }
    if (!onlyOnce(doc.header) || !onlyOnce(doc.footer)) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.section_duplicate" })
    }
    const backwards = all.some(
      (section) =>
        section.starts_at &&
        section.ends_at &&
        new Date(section.ends_at).getTime() <= new Date(section.starts_at).getTime()
    )
    if (backwards) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.schedule_invalid" })
    }
  })

export type LayoutDocument = z.infer<typeof layoutDocument>

/** Every page's body sections (home, product, category): checked and shown alike. */
export const bodySections = (doc: LayoutDocument): BodySection[] => [
  ...doc.home,
  ...doc.product,
  ...doc.category,
]

/** Whether a section shows at this moment: visible, and within its dates if it has any. */
export function isShowing(
  section: { visible: boolean; starts_at: string | null; ends_at: string | null },
  now: Date
): boolean {
  const at = now.getTime()
  return (
    section.visible &&
    (!section.starts_at || new Date(section.starts_at).getTime() <= at) &&
    (!section.ends_at || new Date(section.ends_at).getTime() > at)
  )
}

const GROUPS = ["header", "home", "footer", "product", "category"] as const

/**
 * A stored document (a draft, what is live, a revision) as today's schema
 * reads it: its settings read part by part (`storedSettings`), as the
 * storefront's frame reads them, so a part today's schema no longer reads
 * (a theme from before a rule) is unset rather than failing the whole read,
 * and every reader sees the same settings; a section's variant off today's
 * list reads as its replacement or the default (`storedSection`). A save
 * is still held to the schema.
 */
export function storedDocument(stored: unknown): unknown {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return stored
  }
  const groups = Object.fromEntries(
    GROUPS.flatMap((group) => {
      const sections: unknown = (stored as Record<string, unknown>)[group]
      return Array.isArray(sections) ? [[group, sections.map(storedSection)]] : []
    })
  )
  return { ...stored, ...groups, settings: storedSettings(stored) }
}

/** A stored document read through today's schema (see `storedDocument`); throws if it does not read. */
export const readStoredLayout = (stored: unknown): LayoutDocument =>
  layoutDocument.parse(storedDocument(stored))
