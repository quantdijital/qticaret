import { createHash } from "node:crypto"
import { EMPTY_DOC, contentDoc } from "../content"
import type { Block, ContentDoc } from "../content"
import { contentPageSection } from "./layout-pages"
import type { ContentPageSection } from "./layout-pages"
import type { PageRole } from "./page-roles"

/**
 * A content page's text as sections (adr/0073 Ek 2026-11-19 (2)): the
 * sections a page's text becomes (K3, and the store reads' synthesis, K1),
 * where they go in a page from before the text was a section, and the
 * page's `body` mirror (K2), the published text sections' documents in
 * order. Pure: the readers and writers are the workflows'.
 */

/** A page's text section: its document is some of the page's text. */
export type PageTextSection = Extract<ContentPageSection, { type: "rich_text" | "contact" }>

export const isPageText = (section: ContentPageSection): section is PageTextSection =>
  section.type === "rich_text" || section.type === "contact"

/** Whether a page's sections hold any of its text. */
export const hasPageText = (sections: readonly ContentPageSection[]): boolean =>
  sections.some(isPageText)

/** What a page's text sections are made from: the page's id and text, and its roles. */
export interface PageTextSource {
  id: string
  body: ContentDoc
  roles: readonly PageRole[]
}

/**
 * A section's id made from the page's (K3): the same on every run, the
 * section kind telling a page's sections apart; one another section of
 * the design already holds takes the next of its kind.
 */
export function pageSectionId(pageId: string, kind: string, taken: ReadonlySet<string>): string {
  for (let n = 0; ; n += 1) {
    const seed = n === 0 ? `${pageId}:${kind}` : `${pageId}:${kind}:${String(n)}`
    const id = `p${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`
    if (!taken.has(id)) {
      return id
    }
  }
}

const isEmpty = (doc: ContentDoc): boolean => doc.content.length === 0

/**
 * The sections a page's text becomes (K3's table): the contact page's
 * `contact` with its text; else the text as `article` (none for an empty
 * one); then the payment or shipping page's live facts. A page with no
 * text and no role becomes none. Ids are the page's (`pageSectionId`),
 * clear of `taken`, which they join.
 */
export function pageTextSections(source: PageTextSource, taken: Set<string>): ContentPageSection[] {
  const raw: Record<string, unknown>[] = []
  const id = (kind: string) => {
    const made = pageSectionId(source.id, kind, taken)
    taken.add(made)
    return made
  }
  if (source.roles.includes("contact")) {
    raw.push({ id: id("contact"), type: "contact", body: source.body })
  } else if (!isEmpty(source.body)) {
    raw.push({ id: id("article"), type: "rich_text", variant: "article", body: source.body })
  }
  if (source.roles.includes("payment")) {
    raw.push({ id: id("payment"), type: "payment_facts" })
  }
  if (source.roles.includes("shipping")) {
    raw.push({ id: id("shipping"), type: "shipping_facts" })
  }
  return raw.flatMap((section) => {
    const parsed = contentPageSection.safeParse(section)
    return parsed.success ? [parsed.data] : []
  })
}

/**
 * A page's sections with its text sections at `at` (a page from before
 * its text was a section, K1 `text_at`), the twelve a page holds kept:
 * past them the last ones go (the sections below the text first). How
 * many went is said.
 */
export function withTextAt(
  sections: readonly ContentPageSection[],
  texts: readonly ContentPageSection[],
  at: number,
  max: number
): { sections: ContentPageSection[]; dropped: number } {
  const place = Math.max(0, Math.min(at, sections.length))
  const all = [...sections.slice(0, place), ...texts, ...sections.slice(place)]
  return { sections: all.slice(0, max), dropped: Math.max(0, all.length - max) }
}

const heading = (title: string): Block => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text: title }],
})

/** Whether a document stays within the content document's bounds (`DOC_LIMITS`). */
const fits = (doc: ContentDoc): boolean => contentDoc.safeParse(doc).success

/**
 * The page's `body` mirror (K2): its text sections shown at all times
 * (visible, unscheduled) in order, their documents joined, a titled
 * one's title first as an h2. One untitled section's
 * mirror is its document as it is (a converted page's mirror is its
 * text: nothing to write). Sections past the document's bounds are left
 * out of the mirror. None: the empty document.
 */
export function pageMirror(sections: readonly ContentPageSection[]): ContentDoc {
  // Only text shown at all times: a scheduled section (`starts_at`/`ends_at`) would reach the
  // page's description, dates and advisor before it shows, or after it ends (security review S6)
  const texts = sections
    .filter(isPageText)
    .filter((section) => section.visible && !section.starts_at && !section.ends_at)
  const [only] = texts
  if (texts.length === 1 && only && (only.type === "contact" || only.title === null)) {
    return only.body
  }
  let mirror: ContentDoc = EMPTY_DOC
  for (const section of texts) {
    const title = section.type === "rich_text" ? section.title : null
    const next: ContentDoc = {
      type: "doc",
      content: [...mirror.content, ...(title ? [heading(title)] : []), ...section.body.content],
    }
    if (!fits(next)) {
      break
    }
    mirror = next
  }
  return mirror
}
