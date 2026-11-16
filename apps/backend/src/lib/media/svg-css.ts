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

// A selector of classes, ids and elements, grouped and combined
const SELECTOR = /^[a-zA-Z0-9_\-.#\s>,*]+$/
// A value of plain characters: words, numbers, units, colours, commas, functions' parentheses
const VALUE = /^[a-zA-Z0-9#.,%\s()-]+$/
// `url(#id)`, the only reference a value may hold
const LOCAL_URL = /^url\(#[a-zA-Z0-9_-]+\)$/
const FUNCTION = /([a-zA-Z-]+)\(/g
const FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "url"])

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
  for (const match of value.matchAll(FUNCTION)) {
    if (!FUNCTIONS.has((match[1] ?? "").toLowerCase())) {
      return null
    }
  }
  if (/url\(/i.test(value) && !LOCAL_URL.test(value)) {
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

/** A `<style>` element's sheet as kept: only whole rules the list reads; "" when none. */
export function cleanStyleSheet(text: string): string {
  // Comments first (a rule's text may not hide in one); an unclosed one ends the sheet
  const plain = text.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ")
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
      rules.push(`${selector.replace(/\s+/g, " ")}{${declarations}}`)
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
  if (/[\\@]|image-set|image\(|expression|javascript:/i.test(value)) {
    return true
  }
  const urls = value.match(/url\([^)]*\)?/gi) ?? []
  return urls.some((url) => !LOCAL_URL.test(url.replace(/\s+/g, "")))
}
