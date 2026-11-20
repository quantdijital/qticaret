import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { LAYOUT_LIMITS, readStoredLayout, sectionIds } from "../../lib/storefront/layout"
import { legacyTextAt } from "../../lib/storefront/layout-pages-stored"
import type { ContentPageSection, LayoutDocument } from "../../lib/storefront/layout"
import {
  hasPageText,
  isPageText,
  pageSectionId,
  pageTextSections,
  withTextAt,
} from "../../lib/storefront/page-text"
import { layoutRow } from "./layout-row"
import { pageTextSources } from "./page-text-source"

type Container = Pick<MedusaContainer, "resolve">

/** A design that may hold pages from before their text was a section, and where that text stands. */
export interface TextedDesign {
  document: LayoutDocument
  /** `legacyTextAt` of the stored document it was read from. */
  text_at: Record<string, number>
}

/**
 * A design with older pages' text placed, and the text sections placed
 * (`carried`): the page's text as it was, not the editor's new work, so a
 * save's checks take their cards and images as already known (security
 * review S6: a card or library image gone since must not lock the editor).
 */
export interface PlacedDesign {
  document: LayoutDocument
  carried: ContentPageSection[]
}

/** The draft's text sections of a page as they stand now, by page id; none read, none. */
function draftTexts(stored: unknown): Map<string, ContentPageSection[]> {
  try {
    const draft = readStoredLayout(stored)
    return new Map(
      draft.pages.map((page) => [page.page_id, page.sections.filter((each) => isPageText(each))])
    )
  } catch {
    return new Map()
  }
}

/**
 * A design brought back into the draft (a revision restored, the live
 * design on a discard, a saved look; adr/0073 Ek 2026-11-19 (2) K6) with
 * each of its pages from before their text was a section given today's
 * text where it stood (`text_at`): the page's text sections in the draft
 * now, else its text made into sections from its mirror (K1). A design
 * from before the conversion never takes a page's text away. Ids taken by
 * the design's own sections are made anew from the page's. Reads only.
 */
export async function placePageTexts(
  container: Container,
  design: TextedDesign
): Promise<PlacedDesign> {
  const { document, text_at } = design
  const waiting = document.pages.filter(
    (page) => text_at[page.page_id] !== undefined && !hasPageText(page.sections)
  )
  if (waiting.length === 0) {
    return { document, carried: [] }
  }
  const row = await layoutRow(container)
  const current = draftTexts(row?.draft ?? null)
  const sources = await pageTextSources(
    container,
    waiting.filter((page) => !current.get(page.page_id)?.length).map((page) => page.page_id)
  )
  const taken = sectionIds(document)
  const placed = new Map<string, ContentPageSection[]>()
  const carried: ContentPageSection[] = []
  for (const page of waiting) {
    const kept = (current.get(page.page_id) ?? []).map((section) => {
      const id = taken.has(section.id)
        ? pageSectionId(page.page_id, `kept:${section.id}`, taken)
        : section.id
      taken.add(id)
      return { ...section, id }
    })
    const source = sources.get(page.page_id)
    const texts = kept.length > 0 ? kept : source ? pageTextSections(source, taken) : []
    const at = text_at[page.page_id] ?? 0
    const sections = withTextAt(page.sections, texts, at, LAYOUT_LIMITS.page).sections
    placed.set(page.page_id, sections)
    carried.push(...texts.filter((text) => sections.includes(text)))
  }
  return {
    document: {
      ...document,
      pages: document.pages.map((page) => {
        const sections = placed.get(page.page_id)
        return sections ? { ...page, sections } : page
      }),
    },
    carried,
  }
}

/** `placePageTexts` as a step of a draft's replacement, under the design's lock. */
export const placePageTextsStep = createStep(
  "storefront-place-page-texts",
  async (design: TextedDesign, { container }) =>
    new StepResponse(await placePageTexts(container, design))
)

/**
 * A draft written over the stored one (a save, a publication of a draft
 * never saved since) keeps each older page's text (adr/0073 Ek 2026-11-19
 * (2) K1, K6): a page the stored draft laid out before its text was a
 * section, or one an older editor lays out so (`given`, from its
 * `placement`), and that holds no text section, takes its text where it
 * stood. Reads only.
 */
export async function keepPageTexts(
  container: Container,
  document: LayoutDocument,
  given: Readonly<Record<string, number>> = {}
): Promise<PlacedDesign> {
  const row = await layoutRow(container)
  const text_at = { ...legacyTextAt(row?.draft ?? null), ...given }
  return Object.keys(text_at).length > 0
    ? placePageTexts(container, { document, text_at })
    : { document, carried: [] }
}

/** `keepPageTexts` as a step of a draft's save, under the design's lock. */
export const keepPageTextsStep = createStep(
  "storefront-keep-page-texts",
  async (input: { document: LayoutDocument; text_at?: Record<string, number> }, { container }) =>
    new StepResponse(await keepPageTexts(container, input.document, input.text_at))
)
