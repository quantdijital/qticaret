import type { RecordFacts } from "./types"

/**
 * A page's own search fields (adr/0015 `seo_meta`, linked to a product
 * and a category), as the advisor reads them (workflows/seo/advisor
 * `OWN_FIELDS`): the focus keyword the page aims at and the search title
 * and description it carries now (adr/0074 §4). The shop's own words for
 * its page; no robots or canonical setting goes.
 */
export const SEO_FACT_FIELDS = [
  "seo_meta.focus_keyword",
  "seo_meta.seo_title",
  "seo_meta.seo_description",
] as const

export interface SeoRow {
  focus_keyword?: string | null
  seo_title?: string | null
  seo_description?: string | null
}

/** The data block's names for them; the instructions name the same (lib/ai/crafts/seo.ts). */
export function seoFactsOf(row: SeoRow | null | undefined): RecordFacts {
  return {
    focus_keyword: row?.focus_keyword ?? null,
    current_seo_title: row?.seo_title ?? null,
    current_seo_description: row?.seo_description ?? null,
  }
}
