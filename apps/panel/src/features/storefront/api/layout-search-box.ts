import type { BodySectionBase } from "@/features/storefront/api/layout-sections"

/**
 * The search box section of the theme editor's document (adr/0077 §1): an
 * optional title and intro over the shop's one search box. The box's
 * fields are the theme's (`ThemeSettings.search_form`), not the section's;
 * its ground and alignment are the look's.
 */
export type SearchBoxSection = BodySectionBase & {
  type: "search_box"
  /** None: no heading. */
  title: string | null
  /** May hold the shop's details (`{mağaza_adı}`). */
  intro: string | null
}
