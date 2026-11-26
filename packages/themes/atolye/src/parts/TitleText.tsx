import type { ReactNode } from "react"

/** A pair of asterisks around words: `En *sevilen* turlar`. */
const ACCENT = /\*([^*]+)\*/g
/** The same pair, once: a test with no state (a global pattern keeps its last place). */
const HAS_ACCENT = /\*[^*]+\*/

/**
 * A section heading's words with its accent (the style kit's S10
 * `section_title`, adr/0067): the words the shop put between asterisks
 * come as an `em` the theme draws in the accent face's italic when the
 * kit asks (`section-title.css`) and as the heading's own words when not.
 * A heading with no pair prints as it always did, the bare string; a
 * lone asterisk stays as written.
 */
export function TitleText({ text }: { text: string }): ReactNode {
  if (!HAS_ACCENT.test(text)) {
    return text
  }
  const parts: ReactNode[] = []
  let at = 0
  for (const match of text.matchAll(ACCENT)) {
    if (match.index > at) {
      parts.push(text.slice(at, match.index))
    }
    parts.push(
      <em key={match.index} className="gf-title-em">
        {match[1]}
      </em>
    )
    at = match.index + match[0].length
  }
  if (at < text.length) {
    parts.push(text.slice(at))
  }
  return parts
}

/** The heading's words without the accent's asterisks: a region's name, a screen reader's. */
export const plainTitle = (text: string): string => text.replace(ACCENT, "$1")
