import type {
  Block,
  BulletList,
  ContentDoc,
  Inline,
  ListItem,
  Mark,
  OrderedList,
  Paragraph,
} from "./doc"
import { isSafeHref } from "./doc"

/**
 * Plain Markdown as a content document (adr/0019), for texts brought from
 * another site (F14, F18 shop profile). Only what the document allows:
 * headings (h1 is the page's own title and is left out; h2, h3, deeper
 * ones h4), paragraphs, bullet and numbered lists, quotes, bold, italic
 * and safe links. Pictures and tables are dropped: a picture must come
 * from the shop's media library, a table is rare in such texts. The
 * result still goes through `contentDoc` on save.
 */

export interface MarkdownOptions {
  /** The old site's host: its absolute links become paths on the shop ("/iletisim"). */
  siteHost?: string | null
  /** The page's own title: a heading that only repeats it is left out. */
  title?: string | null
}

const sameWords = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr")

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*(\d{1,4})[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const IMAGE = /!\[[^\]]*]\([^)]*\)/g
const TABLE_ROW = /^\s*\|.*\|\s*$/
// [text](href), **bold**, *italic* / _italic_; the first match wins
const INLINE =
  /\[([^\]]+)]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g

/** An old site's own absolute address as a path here; any other link as it is. */
function hrefOf(raw: string, siteHost: string | null): string | null {
  let href = raw.trim()
  if (siteHost) {
    try {
      const url = new URL(href)
      const host = url.hostname.toLowerCase().replace(/^www\./, "")
      if (host === siteHost.toLowerCase().replace(/^www\./, "")) {
        const path = url.pathname.replace(/\/+$/, "") || "/"
        href = `${path}${url.search}`
      }
    } catch {
      // Not absolute: kept as written
    }
  }
  return isSafeHref(href) ? href : null
}

function textNode(text: string, marks: Mark[]): Inline[] {
  if (text === "") {
    return []
  }
  return [marks.length > 0 ? { type: "text", text, marks } : { type: "text", text }]
}

/** One line's (or a joined paragraph's) inline text with its marks. */
export function inlineOf(text: string, siteHost: string | null = null): Inline[] {
  const nodes: Inline[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    nodes.push(...textNode(text.slice(last, match.index), []))
    const [whole, linkText, linkHref, bold, boldUnderscore, italic, italicUnderscore] = match
    if (linkText !== undefined && linkHref !== undefined) {
      const href = hrefOf(linkHref, siteHost)
      nodes.push(...textNode(linkText, href ? [{ type: "link", attrs: { href } }] : []))
    } else if (bold !== undefined || boldUnderscore !== undefined) {
      nodes.push(...textNode(bold ?? boldUnderscore ?? "", [{ type: "bold" }]))
    } else if (italic !== undefined || italicUnderscore !== undefined) {
      nodes.push(...textNode(italic ?? italicUnderscore ?? "", [{ type: "italic" }]))
    } else {
      nodes.push(...textNode(whole, []))
    }
    last = match.index + whole.length
  }
  nodes.push(...textNode(text.slice(last), []))
  return nodes
}

const paragraph = (text: string, siteHost: string | null): Paragraph | null => {
  const content = inlineOf(text.replace(/\s+/g, " ").trim(), siteHost)
  return content.length > 0 ? { type: "paragraph", content } : null
}

type ListKind = "bullet" | "ordered"

function listOf(kind: ListKind, items: string[], start: number, siteHost: string | null) {
  const content: ListItem[] = items.flatMap((item) => {
    const body = paragraph(item, siteHost)
    return body ? [{ type: "listItem" as const, content: [body] }] : []
  })
  if (kind === "bullet") {
    return { type: "bulletList", content } satisfies BulletList
  }
  return {
    type: "orderedList",
    ...(start !== 1 ? { attrs: { start } } : {}),
    content,
  } satisfies OrderedList
}

/** Markdown text as a content document; an empty text gives an empty document. */
export function markdownToDoc(markdown: string, options: MarkdownOptions = {}): ContentDoc {
  const siteHost = options.siteHost ?? null
  const blocks: Block[] = []
  let lines: string[] = []
  // Cast, not annotated: the flush closures reassign it, which narrowing cannot see
  let list = null as { kind: ListKind; items: string[]; start: number } | null
  let quote: string[] = []

  const flushParagraph = () => {
    const block = lines.length > 0 ? paragraph(lines.join(" "), siteHost) : null
    if (block) {
      blocks.push(block)
    }
    lines = []
  }
  const flushList = () => {
    if (list && list.items.length > 0) {
      const block = listOf(list.kind, list.items, list.start, siteHost)
      if (block.content.length > 0) {
        blocks.push(block)
      }
    }
    list = null
  }
  const flushQuote = () => {
    const block = quote.length > 0 ? paragraph(quote.join(" "), siteHost) : null
    if (block) {
      blocks.push({ type: "blockquote", content: [block] })
    }
    quote = []
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
    flushQuote()
  }

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(IMAGE, "").trimEnd()
    if (line.trim() === "" || RULE.test(line) || TABLE_ROW.test(line)) {
      flushAll()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flushAll()
      const level = (heading[1] ?? "").length
      const content = inlineOf((heading[2] ?? "").trim(), siteHost)
      // The page's title is its own h1; a text's h1, or a heading that
      // repeats the title, would make a second
      const repeatsTitle = options.title ? sameWords(heading[2] ?? "", options.title) : false
      if (level > 1 && content.length > 0 && !repeatsTitle) {
        blocks.push({
          type: "heading",
          attrs: { level: level === 2 ? 2 : level === 3 ? 3 : 4 },
          content,
        })
      }
      continue
    }
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      flushQuote()
      const kind: ListKind = bullet ? "bullet" : "ordered"
      if (list?.kind !== kind) {
        flushList()
        list = { kind, items: [], start: numbered ? Number(numbered[1]) : 1 }
      }
      list.items.push((bullet ? bullet[1] : numbered?.[2]) ?? "")
      continue
    }
    const quoted = QUOTE.exec(line)
    if (quoted) {
      flushParagraph()
      flushList()
      quote.push(quoted[1] ?? "")
      continue
    }
    if (list) {
      // A line under a list item continues it
      const items: string[] = list.items
      items[items.length - 1] = `${items.at(-1) ?? ""} ${line.trim()}`
      continue
    }
    flushQuote()
    lines.push(line.trim())
  }
  flushAll()
  return { type: "doc", content: blocks }
}
