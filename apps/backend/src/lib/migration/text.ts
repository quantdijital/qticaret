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
// Comments and the contents of tags whose text is no text
const HIDDEN = /<!--[\s\S]*?-->|<(script|style)\b[^<>]*>[\s\S]*?<\/\1\s*>/gi

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

export function htmlToText(html: string | null | undefined): string | null {
  const text = (html ?? "")
    .replace(HIDDEN, "")
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
