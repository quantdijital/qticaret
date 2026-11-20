import { themePageIds } from "@/theme"

/**
 * The anchors a page starts with: the ids its theme writes fixed on it
 * (the skip link's `main`, its text sections' boxes). Each page's
 * headings take theirs after these, one set for the whole page
 * (`withOutline`, `faqOf`), so a heading's anchor never meets one of them
 * or another text's on the same page.
 */
export const pageAnchors = (): Set<string> => new Set(themePageIds)
