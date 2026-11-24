import { isPlainObject } from "../../modules/platform-settings/sections/define"
import { faqRowsOf, readsAsQuestions } from "./faq-text"
import { LAYOUT_LIMITS } from "./layout-fields"
import { contentPageSection } from "./layout-pages"
import type { ContentPageSection } from "./layout-pages"
import { pageSectionId } from "./page-text"
import { designFits, storedIds, storedPage, withStoredPage } from "./page-text-stored"

/**
 * The content pages drawn as questions out of their text (a page text,
 * `rich_text` as `article`, with `questions: auto`) turned into an FAQ
 * section the shop edits question by question (adr/0073 Ek 2026-11-24
 * (2)), in a stored design, pure. The FAQ (`faq` as `page`, drawn as the
 * text was) takes the text's place with its title, its look and when it
 * shows; the text stays right after it, hidden, as it was, so nothing is
 * lost and a second run finds no shown text to turn. A text that does not
 * read as questions, or would not come out the same as an FAQ
 * (`faqRowsOf`), a page with no room for one more section (twelve), and
 * a design the result would not fit are left as they are and counted.
 */

export interface FaqConversionCount {
  /** Texts turned into an FAQ. */
  converted: number
  /** Texts drawn as questions left as they were (would not come out the same, or no room). */
  left: number
}

type Stored = Record<string, unknown>

const pageIdsOf = (doc: Stored): string[] =>
  (Array.isArray(doc["pages"]) ? doc["pages"] : []).flatMap((entry) =>
    isPlainObject(entry) && typeof entry["page_id"] === "string" ? [entry["page_id"]] : []
  )

/** A shown page text still drawn as questions out of its words. */
const isQuestionsText = (
  section: ContentPageSection
): section is Extract<ContentPageSection, { type: "rich_text"; variant: "article" }> =>
  section.type === "rich_text" &&
  section.variant === "article" &&
  section.visible &&
  section.questions === "auto"

/** One page's sections with each such text turned, and how many turned or were left. */
function convertedSections(
  pageId: string,
  sections: readonly ContentPageSection[],
  taken: Set<string>
): { sections: ContentPageSection[]; count: FaqConversionCount } {
  const count: FaqConversionCount = { converted: 0, left: 0 }
  const next: ContentPageSection[] = []
  for (const section of sections) {
    if (!isQuestionsText(section)) {
      next.push(section)
      continue
    }
    if (!readsAsQuestions(section.body)) {
      // An ordinary text (fewer than three questions) was never drawn as questions: not counted
      next.push(section)
      continue
    }
    const rows = faqRowsOf(section.body)
    const room = sections.length + count.converted < LAYOUT_LIMITS.page
    const id = pageSectionId(pageId, `faq:${section.id}`, taken)
    const faq = contentPageSection.safeParse({
      id,
      type: "faq",
      variant: "page",
      title: section.title,
      items: rows,
      visible: true,
      starts_at: section.starts_at,
      ends_at: section.ends_at,
      device: section.device,
      ...(section.look ? { look: section.look } : {}),
    })
    if (rows === null || !room || !faq.success) {
      count.left += 1
      next.push(section)
      continue
    }
    taken.add(id)
    count.converted += 1
    next.push(faq.data, { ...section, visible: false })
  }
  return { sections: next, count }
}

/**
 * The design with every page's questions texts turned into FAQs, and
 * what turned; the same object back when nothing did (nothing to write).
 */
export function convertFaqPages(stored: Stored): { document: Stored; count: FaqConversionCount } {
  let doc = stored
  const total: FaqConversionCount = { converted: 0, left: 0 }
  const taken = storedIds(stored)
  for (const pageId of pageIdsOf(stored)) {
    let page: ReturnType<typeof storedPage>
    try {
      page = storedPage(doc, pageId)
    } catch {
      // A stored entry no build foresaw: left as it is, the others still turn
      continue
    }
    if (!page) {
      continue
    }
    const { sections, count } = convertedSections(pageId, page.sections, taken)
    total.left += count.left
    if (count.converted === 0) {
      continue
    }
    const next = withStoredPage(doc, pageId, sections)
    if (!designFits(next)) {
      total.left += count.converted
      continue
    }
    doc = next
    total.converted += count.converted
  }
  return { document: doc, count: total }
}
