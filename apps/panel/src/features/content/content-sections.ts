import { revealSection } from "@/components/patterns/use-section-open"

/** The parts of a text's page the advisor's "go to field" lands on, by their element ids. */
export const CONTENT_SECTIONS = {
  general: "content-general",
  body: "content-body",
  seo: "content-seo",
  cover: "content-cover-section",
  summary: "content-summary",
  terms: "content-terms",
} as const

const S = CONTENT_SECTIONS

// The advisor's "go to field" targets: the parts above by their ids (a folded one opens)
export const CONTENT_TARGETS: Readonly<Record<string, string>> = {
  edit_title: S.seo,
  edit_description: S.seo,
  edit_robots: S.seo,
  use_template_title: S.seo,
  use_template_description: S.seo,
  edit_body: S.body,
  edit_handle: S.general,
  edit_author: S.summary,
  add_image: S.cover,
}

const SIDE: ReadonlySet<string> = new Set([S.cover, S.summary, S.terms])

// Tailwind's `xl`: from here the narrow column sits beside the text and follows the scroll
const WIDE = "(min-width: 80rem)"

const wide = () => typeof window.matchMedia === "function" && window.matchMedia(WIDE).matches

/**
 * The advisor's "go to field" on a text's page. A card of the narrow
 * column, while that column follows the scroll beside the text, is
 * brought into the column's own view and the page stays where it is;
 * anything else (a folded part opening first) is scrolled to its top.
 */
export function revealContentTarget(target: string): void {
  if (SIDE.has(target) && wide()) {
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    return
  }
  revealSection(target)
}
