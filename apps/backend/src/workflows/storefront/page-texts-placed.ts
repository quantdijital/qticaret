import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { LAYOUT_LIMITS, readStoredLayout, sectionIds } from "../../lib/storefront/layout"
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
): Promise<LayoutDocument> {
  const { document, text_at } = design
  const waiting = document.pages.filter(
    (page) => text_at[page.page_id] !== undefined && !hasPageText(page.sections)
  )
  if (waiting.length === 0) {
    return document
  }
  const row = await layoutRow(container)
  const current = draftTexts(row?.draft ?? null)
  const sources = await pageTextSources(
    container,
    waiting.filter((page) => !current.get(page.page_id)?.length).map((page) => page.page_id)
  )
  const taken = sectionIds(document)
  const placed = new Map<string, ContentPageSection[]>()
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
    placed.set(page.page_id, withTextAt(page.sections, texts, at, LAYOUT_LIMITS.page).sections)
  }
  return {
    ...document,
    pages: document.pages.map((page) => {
      const sections = placed.get(page.page_id)
      return sections ? { ...page, sections } : page
    }),
  }
}

/** `placePageTexts` as a step of a draft's replacement, under the design's lock. */
export const placePageTextsStep = createStep(
  "storefront-place-page-texts",
  async (design: TextedDesign, { container }) =>
    new StepResponse(await placePageTexts(container, design))
)
