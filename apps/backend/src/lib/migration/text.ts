/**
 * A source's HTML description as the plain text a product keeps (adr/0042
 * §1): paragraphs, line breaks and list items kept as lines, every other
 * tag dropped, the usual entities read. Never parsed as markup: a tag is
 * only ever taken out, so nothing in it can run anywhere.
 */

// Tags that end a line where they stand
const BREAKS = /<\s*(br|\/p|\/div|\/h[1-6]|\/tr|\/ul|\/ol)\b[^<>]*>/gi
const ITEM = /<\s*li\b[^<>]*>/gi
// Any other tag: `<` then a letter (or `/` and a letter), up to its `>`
const TAG = /<\/?[a-z][^<>]*>/gi
// Comments and the contents of tags whose text is no text, with how each ends
const HIDDEN = [
  ["<!--", "-->"],
  ["<script", "</script"],
  ["<style", "</style"],
] as const

/**
 * The text without its comments, scripts and styles, in one pass (a
 * pattern would go back over the rest for each one left open): one never
 * closed hides the rest, as a browser would.
 */
function withoutHidden(html: string): string {
  // ASCII letters only, so every index stays the original's ("İ" lowercases to two)
  const lower = html.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
  const next = HIDDEN.map(([open]) => lower.indexOf(open))
  let out = ""
  let at = 0
  for (;;) {
    let pick = -1
    next.forEach((place, index) => {
      if (place !== -1 && (pick === -1 || place < (next[pick] ?? Infinity))) {
        pick = index
      }
    })
    const start = next[pick] ?? -1
    const pair = HIDDEN[pick]
    if (!pair || start === -1) {
      return out + html.slice(at)
    }
    out += html.slice(at, start)
    const end = lower.indexOf(pair[1], start + pair[0].length)
    if (end === -1) {
      return out
    }
    // A comment ends with its marker; a closing tag at its `>`
    const close = pair[1] === "-->" ? end + 3 : lower.indexOf(">", end) + 1
    at = close > 0 ? close : html.length
    next.forEach((place, index) => {
      if (place !== -1 && place < at) {
        next[index] = lower.indexOf(HIDDEN[index]?.[0] ?? "", at)
      }
    })
  }
}

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function entity(_whole: string, body: string): string {
  if (body.startsWith("#")) {
    const code =
      body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
    // A control or a code past Unicode is no character to keep
    return Number.isInteger(code) && code >= 32 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : ""
  }
  return NAMED[body.toLowerCase()] ?? `&${body};`
}

/** A text's XML or HTML entities read (`&amp;` → `&`); the secure XML reader leaves them. */
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x?[0-9a-f]{1,6}|[a-z]{2,8});/gi, entity)

export function htmlToText(html: string | null | undefined): string | null {
  const text = withoutHidden(html ?? "")
    .replace(ITEM, "\n• ")
    .replace(BREAKS, "\n")
    .replace(TAG, "")
    .replace(/&(#x?[0-9a-f]{1,6}|[a-z]{2,8});/gi, entity)
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text === "" ? null : text
}
