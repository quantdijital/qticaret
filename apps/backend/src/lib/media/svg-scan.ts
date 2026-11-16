/**
 * Reads of an SVG's text before anything parses it (`svg.ts`): plain
 * character loops and `indexOf`, every one linear in the text. No regular
 * expression with a quantifier runs on the text here: the earlier ones
 * backtracked (a file of comments, a run of `<a`, a long run of spaces
 * held the process for seconds or for good, security review 2026-11-16).
 */

/** The most elements, nesting, attributes on one element and in all that an SVG may have. */
export const SVG_MAX_ELEMENTS = 5_000
export const SVG_MAX_DEPTH = 64
export const SVG_MAX_ATTRIBUTES = 64
export const SVG_MAX_ALL_ATTRIBUTES = 20_000
/** One attribute's value at most (a path's `d` can be long: a whole logo's outline). */
export const SVG_MAX_VALUE = 100_000

/** How far into a file its start is looked for. */
const HEAD = 4_096

const isSpace = (code: number) =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c
const isLetter = (code: number) => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)

function skipSpaces(text: string, from: number): number {
  let at = from
  while (at < text.length && isSpace(text.charCodeAt(at))) {
    at++
  }
  return at
}

const startsWithAt = (text: string, at: number, word: string): boolean =>
  text.slice(at, at + word.length).toLowerCase() === word

/**
 * A detection, not a cleaner: does the file start as an SVG document? A
 * byte order mark and spaces, an optional `<?xml …?>`, comments and a
 * DOCTYPE (its internal subset too) in any order, then `<svg` and a space
 * or `>`; within the first 4 KB, or it is no SVG.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  let text = Buffer.from(bytes.subarray(0, HEAD)).toString("utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  let at = skipSpaces(text, 0)
  if (startsWithAt(text, at, "<?xml")) {
    const end = text.indexOf("?>", at)
    if (end < 0) {
      return false
    }
    at = skipSpaces(text, end + 2)
  }
  for (;;) {
    if (startsWithAt(text, at, "<!--")) {
      const end = text.indexOf("-->", at + 4)
      if (end < 0) {
        return false
      }
      at = skipSpaces(text, end + 3)
    } else if (startsWithAt(text, at, "<!doctype")) {
      const subset = text.indexOf("[", at)
      const close = text.indexOf(">", at)
      if (close < 0) {
        return false
      }
      // An internal subset `[ … ]` may hold `>`: the DOCTYPE ends at the `>` after its `]`
      const end =
        subset >= 0 && subset < close ? text.indexOf(">", text.indexOf("]", subset)) : close
      if (end < 0) {
        return false
      }
      at = skipSpaces(text, end + 1)
    } else {
      break
    }
  }
  if (!startsWithAt(text, at, "<svg")) {
    return false
  }
  const next = text.charCodeAt(at + 4)
  return isSpace(next) || next === 0x3e
}

/** A width or height of plain digits (and `px`), else null; never a long string. */
export function plainNumber(value: string | null): number | null {
  if (value === null || value.length > 32) {
    return null
  }
  const text = value.trim()
  if (!/^\d+(\.\d+)?(px)?$/.test(text)) {
    return null
  }
  const parsed = Number.parseFloat(text)
  return parsed > 0 ? parsed : null
}

export type ScanRefusal = "upload.svg_too_complex"

/** Where a comment that starts at `at` ends: `<!-->` and `<!--->` are empty, one never closed ends the text. */
function commentEnd(text: string, at: number): number {
  if (text.charCodeAt(at + 4) === 0x3e) {
    return at + 5
  }
  if (text.startsWith("->", at + 4)) {
    return at + 6
  }
  const end = text.indexOf("-->", at + 4)
  return end < 0 ? text.length : end + 3
}

/**
 * The tag's name from `at` (just after `<` or `</`) and where its text
 * ends; attributes counted by their `=` (one in a value counts as one more:
 * a count too high only refuses).
 */
function readTag(
  text: string,
  at: number
): { name: string; end: number; equals: number; selfClosing: boolean } {
  let index = at
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (isSpace(code) || code === 0x2f || code === 0x3e) {
      break
    }
    index++
  }
  const name = text.slice(at, index).toLowerCase()
  const close = text.indexOf(">", index)
  const end = close < 0 ? text.length : close
  let equals = 0
  for (let i = index; i < end; i++) {
    if (text.charCodeAt(i) === 0x3d) {
      equals++
    }
  }
  return {
    name,
    end: close < 0 ? text.length : close + 1,
    equals,
    selfClosing: close > 0 && text.charCodeAt(close - 1) === 0x2f,
  }
}

/**
 * A linear look at the text before it is parsed: elements (start tags),
 * nesting as an HTML parser would follow it (an end tag closes the
 * nearest open element of its name, one with none open is ignored),
 * attributes on each element and in all. Comments (empty ones too) and
 * other markup declarations are skipped. It may count more than the tree
 * a parser builds, never less, so a file past it is refused.
 */
export function prescan(text: string): ScanRefusal | null {
  const open: string[] = []
  let elements = 0
  let attributes = 0
  let at = text.indexOf("<")
  while (at >= 0 && at < text.length) {
    const next = text.charCodeAt(at + 1)
    let end: number
    if (text.startsWith("<!--", at)) {
      end = commentEnd(text, at)
    } else if (next === 0x21 || next === 0x3f) {
      // `<!DOCTYPE …>`, `<![CDATA[`, `<?…>`: up to its `>`
      const close = text.indexOf(">", at)
      end = close < 0 ? text.length : close + 1
    } else if (next === 0x2f && isLetter(text.charCodeAt(at + 2))) {
      const tag = readTag(text, at + 2)
      const index = open.lastIndexOf(tag.name)
      if (index >= 0) {
        open.length = index
      }
      end = tag.end
    } else if (isLetter(next)) {
      const tag = readTag(text, at + 1)
      elements++
      attributes += tag.equals
      if (
        elements > SVG_MAX_ELEMENTS ||
        tag.equals > SVG_MAX_ATTRIBUTES ||
        attributes > SVG_MAX_ALL_ATTRIBUTES
      ) {
        return "upload.svg_too_complex"
      }
      if (!tag.selfClosing) {
        open.push(tag.name)
        if (open.length > SVG_MAX_DEPTH) {
          return "upload.svg_too_complex"
        }
      }
      end = tag.end
    } else {
      end = at + 1
    }
    at = text.indexOf("<", end)
  }
  return null
}
