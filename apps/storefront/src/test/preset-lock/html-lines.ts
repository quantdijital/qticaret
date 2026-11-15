/**
 * A page's HTML as the preset lock keeps it (docs/tema/bilesen-standardi
 * §7): what changes from one run to the next taken out, then one tag or
 * text per line, indented by depth, a long tag's attributes one per line,
 * so a changed class reads as one changed line in a review.
 */

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
])

/** Elements whose content is not HTML: kept as written, a stylesheet broken at its rules. */
const RAW = new Set(["style", "script"])

const LONG_TAG = 100

/**
 * A Lucide icon kept as its tag alone: its name is in its class
 * (`lucide-star`), its paths are the icon set's, and the attributes every
 * Lucide icon carries say nothing; its size, stroke and class stay.
 */
const LUCIDE = /<svg([^>]*\sclass="lucide [^"]*"[^>]*)>[\s\S]*?<\/svg>/g
const LUCIDE_DEFAULTS =
  / (?:xmlns="http:\/\/www\.w3\.org\/2000\/svg"|viewBox="0 0 24 24"|fill="none"|stroke="currentColor"|stroke-linecap="round"|stroke-linejoin="round")/g

/**
 * What a render prints differently each time, or after an unrelated
 * change elsewhere on the page: React's `useId` values (`_R_1a_`, older
 * `«r1»`, `:r1:`) and a style or script nonce.
 */
export function normalized(html: string): string {
  return html
    .replace(LUCIDE, (_, attributes: string) => `<svg${attributes.replace(LUCIDE_DEFAULTS, "")}/>`)
    .replace(/_R_[0-9A-Za-z]+_/g, "«id»")
    .replace(/«r[0-9a-z]+»/g, "«id»")
    .replace(/:r[0-9a-z]+:/g, "«id»")
    .replace(/ nonce="[^"]*"/g, ' nonce="«nonce»"')
}

const ATTRIBUTE = /\s+([^\s=/>]+)(?:="([^"]*)")?/g

function tagLines(tag: string, pad: string): string[] {
  if (tag.length + pad.length <= LONG_TAG) {
    return [pad + tag]
  }
  const name = /^<\/?([^\s/>]+)/.exec(tag)?.[1] ?? ""
  const closing = tag.endsWith("/>") ? "/>" : ">"
  const body = tag.slice(name.length + 1, tag.length - closing.length)
  const attributes = [...body.matchAll(ATTRIBUTE)].map(([, key, value]) =>
    value === undefined ? `${pad}  ${key ?? ""}` : `${pad}  ${key ?? ""}="${value}"`
  )
  return [`${pad}<${name}`, ...attributes, pad + closing]
}

/** A stylesheet a declaration per line; a script as written, broken after its blocks. */
const rawLines = (text: string, pad: string, style: boolean): string[] =>
  (style ? text.replace(/([{;])/g, "$1\n").replace(/}/g, "\n}\n") : text.replace(/}/g, "}\n"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => pad + line)

/** The HTML, normalized, a line per tag or text. */
export function htmlLines(html: string): string {
  const source = normalized(html)
  const lines: string[] = []
  let depth = 0
  let at = 0
  const pad = () => "  ".repeat(depth)
  while (at < source.length) {
    if (source.startsWith("<!--", at)) {
      const end = source.indexOf("-->", at) + 3
      lines.push(pad() + source.slice(at, end))
      at = end
      continue
    }
    if (source[at] === "<") {
      const end = source.indexOf(">", at) + 1
      const tag = source.slice(at, end)
      const name = (/^<\/?([^\s/>]+)/.exec(tag)?.[1] ?? "").toLowerCase()
      at = end
      if (tag.startsWith("</")) {
        depth = Math.max(0, depth - 1)
        lines.push(pad() + tag)
        continue
      }
      lines.push(...tagLines(tag, pad()))
      if (VOID.has(name) || tag.endsWith("/>")) {
        continue
      }
      if (RAW.has(name)) {
        const close = source.indexOf(`</${name}>`, at)
        lines.push(...rawLines(source.slice(at, close), `${pad()}  `, name === "style"))
        lines.push(`${pad()}</${name}>`)
        at = close + name.length + 3
        continue
      }
      depth += 1
      continue
    }
    const next = source.indexOf("<", at)
    const end = next < 0 ? source.length : next
    const text = source.slice(at, end).trim()
    if (text.length > 0) {
      lines.push(pad() + text)
    }
    at = end
  }
  return `${lines.join("\n")}\n`
}

export interface PageParts {
  /** The page without its sections, a `<!-- section … -->` line in each one's place. */
  page: string
  /** Each section's lines (`data-qs`, its id) by `<nn>-<id>`, in the page's order. */
  sections: { name: string; html: string }[]
}

/**
 * A page's lines (`htmlLines`) cut at its top-level elements: each section
 * (`data-qs="id"`) on its own, so one section's change is one file's and a
 * long page stays readable.
 */
export function pageParts(lines: string): PageParts {
  const chunks: string[][] = []
  for (const line of lines.split("\n")) {
    if (/^<[a-zA-Z!]/.test(line) || chunks.length === 0) {
      chunks.push([])
    }
    chunks[chunks.length - 1]?.push(line)
  }
  const page: string[] = []
  const sections: PageParts["sections"] = []
  for (const chunk of chunks) {
    const tagEnd = chunk.findIndex((line) => line.trimEnd().endsWith(">"))
    const tag = chunk.slice(0, tagEnd + 1).join(" ")
    const id = /\sdata-qs="([^"]+)"/.exec(tag)?.[1]
    if (!id) {
      page.push(...chunk)
      continue
    }
    const name = `${String(sections.length + 1).padStart(2, "0")}-${id}`
    page.push(`<!-- section ${name} -->`)
    sections.push({ name, html: `${chunk.join("\n").trimEnd()}\n` })
  }
  return { page: `${page.join("\n").trimEnd()}\n`, sections }
}
