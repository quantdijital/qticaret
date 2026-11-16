/**
 * CSS an SVG logo may keep (`svg.ts`): rebuilt from an allow list, never
 * filtered. Design programs colour their shapes through classes
 * (Illustrator's and Figma's `<style>.cls-1{fill:#…}`), so a style sheet
 * is kept where each rule is one this list reads in full: class, id and
 * element selectors; colour, opacity, stroke and fill properties; values
 * of plain characters, `url()` only to an `#id`. Anything else (an
 * at-rule, a backslash escape, a quote, an image function, an unknown
 * property) drops the whole rule; what is kept is written out again from
 * the parts read, so nothing the list did not read reaches the file.
 */

const PROPERTIES = new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "clip-rule",
  "stop-color",
  "stop-opacity",
  "color",
  "display",
  "visibility",
  "isolation",
  "mix-blend-mode",
  "paint-order",
  "vector-effect",
  "shape-rendering",
])

// Every pattern here is one character class under one quantifier, anchored at both ends:
// linear, no backtracking (security review 2026-11-16)
// A selector of classes, ids and elements, grouped and combined
const SELECTOR = /^[a-zA-Z0-9_\-.#\s>,*]+$/
// A value of plain characters: words, numbers, units, colours, commas, functions' parentheses
const VALUE = /^[a-zA-Z0-9#.,%\s()-]+$/
// `url(#id)`, the only reference a value may hold
const LOCAL_URL = /^url\(#[a-zA-Z0-9_-]+\)$/
const FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "url"])

const isNameCharacter = (code: number) =>
  (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x2d

/** The names of the functions a value calls (`rgb(` → "rgb"), read backwards from each `(`. */
function functionsOf(value: string): string[] {
  const names: string[] = []
  for (let open = value.indexOf("("); open >= 0; open = value.indexOf("(", open + 1)) {
    let start = open
    while (start > 0 && isNameCharacter(value.charCodeAt(start - 1))) {
      start--
    }
    names.push(value.slice(start, open).toLowerCase())
  }
  return names
}

/** One `property: value`, rebuilt; null when the list does not read it in full. */
function declaration(text: string): string | null {
  const colon = text.indexOf(":")
  if (colon < 0) {
    return null
  }
  const property = text.slice(0, colon).trim().toLowerCase()
  const value = text.slice(colon + 1).trim()
  if (!PROPERTIES.has(property) || value === "" || !VALUE.test(value)) {
    return null
  }
  if (functionsOf(value).some((name) => !FUNCTIONS.has(name))) {
    return null
  }
  if (value.toLowerCase().includes("url(") && !LOCAL_URL.test(value)) {
    return null
  }
  return `${property}:${value}`
}

/**
 * Declarations as kept: none at all when the text holds an escape, an
 * at-rule, a quote or a brace; else each one the list reads in full (an
 * unknown property is left out). Null when none is kept.
 */
export function cleanDeclarations(text: string): string | null {
  if (/[\\@"'<>{}]/.test(text)) {
    return null
  }
  const kept = text
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(declaration)
    .filter((part): part is string => part !== null)
  return kept.length > 0 ? kept.join(";") : null
}

/** The sheet without its comments (a rule's text may not hide in one); an unclosed one ends it. */
function withoutComments(text: string): string {
  const parts: string[] = []
  let at = 0
  for (let open = text.indexOf("/*"); open >= 0; open = text.indexOf("/*", at)) {
    parts.push(text.slice(at, open), " ")
    const close = text.indexOf("*/", open + 2)
    if (close < 0) {
      return parts.join("")
    }
    at = close + 2
  }
  parts.push(text.slice(at))
  return parts.join("")
}

/** A `<style>` element's sheet as kept: only whole rules the list reads; "" when none. */
export function cleanStyleSheet(text: string): string {
  const plain = withoutComments(text)
  const rules: string[] = []
  for (const chunk of plain.split("}")) {
    const open = chunk.indexOf("{")
    if (open < 0) {
      continue
    }
    const selector = chunk.slice(0, open).trim()
    const body = chunk.slice(open + 1)
    if (selector === "" || !SELECTOR.test(selector) || body.includes("{")) {
      continue
    }
    const declarations = cleanDeclarations(body)
    if (declarations) {
      rules.push(`${selector.split(/\s+/).join(" ")}{${declarations}}`)
    }
  }
  return rules.join("")
}

/**
 * Whether an attribute's value (a presentation attribute such as `fill`
 * or `clip-path`) reaches outside the document or hides something: a
 * backslash escape, an at-rule, an image function, or a `url()` to
 * anything but an `#id`.
 */
export function valueReachesOut(value: string): boolean {
  const lower = value.toLowerCase()
  if (
    lower.includes("\\") ||
    lower.includes("@") ||
    ["image-set", "image(", "expression", "javascript:"].some((word) => lower.includes(word))
  ) {
    return true
  }
  // Each `url(` up to its `)` (none: to the end), read with indexOf, spaces left out
  for (let open = lower.indexOf("url("); open >= 0; open = lower.indexOf("url(", open + 4)) {
    const close = lower.indexOf(")", open)
    const url = value
      .slice(open, close < 0 ? value.length : close + 1)
      .split(/\s/)
      .join("")
    if (!LOCAL_URL.test(url)) {
      return true
    }
  }
  return false
}
