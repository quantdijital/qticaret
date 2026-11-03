import type { Block, ContentDoc, Inline, ListItem } from "../../../content/doc"
import { contentDoc, isSafeHref } from "../../../content/doc"
import { decodeEntities, withoutHidden } from "../../text"
import { BlockBuilder } from "./blocks"
import { expandShortcodes } from "./shortcodes"

/**
 * A WordPress body (the block editor's HTML, a page builder's shortcodes)
 * as the content document (adr/0019) or a product's plain text: headings,
 * paragraphs, lists, quotes and tables with bold, italic and safe links.
 * Its tags are read in one linear scan and only ever dropped or mapped to
 * the document's few nodes: nothing is parsed as markup a browser would
 * run. Pictures, frames, forms and styles are left out (a picture must be
 * the shop's own upload) and counted for the report; comments, scripts
 * and styles go with their contents.
 */

export interface BodyOptions {
  /** The old site's host: its absolute links become paths on the shop. */
  siteHost?: string | null
  /** The page's own title: a heading that only repeats it is left out. */
  title?: string | null
  /** WordPress's shortcodes read (the default); another source's text keeps its brackets. */
  shortcodes?: boolean
}

export interface Body {
  blocks: Block[]
  /** Pictures left out. */
  images: number
  /** Shortcodes that drew what no text keeps: a product grid, a gallery, a saved block. */
  widgets: number
}

const TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>|<[!?][^<>]*>|[^<]+|</g
const BREAKING: ReadonlySet<string> = new Set(
  "p div section article header footer main aside figure figcaption center address dl dt dd details summary nav pre hr".split(
    " "
  )
)
// Elements whose content is no text to keep
const SKIPPED: ReadonlySet<string> = new Set(
  "svg iframe noscript object video audio canvas form button select textarea template map picture".split(
    " "
  )
)
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i
const START = /\bstart\s*=\s*["']?(\d{1,6})/i

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")

/** A link as the shop keeps it: the old site's own address as a path, an unsafe one none. */
export function hrefOf(raw: string, siteHost: string | null): string | null {
  let href = decodeEntities(raw).trim()
  if (href === "" || href.startsWith("#")) {
    return null
  }
  if (URL.canParse(href)) {
    const url = new URL(href)
    if (siteHost && bareHost(url.hostname) === bareHost(siteHost)) {
      href = `${url.pathname.replace(/\/+$/, "") || "/"}${url.search}`
    }
  } else if (href.startsWith("/") && !href.startsWith("//")) {
    // A path on the site: the trailing slash goes, as the shop's paths have none
    const cut = href.search(/[?#]/)
    const path = cut === -1 ? href : href.slice(0, cut)
    href = `${path.replace(/\/+$/, "") || "/"}${cut === -1 ? "" : href.slice(cut)}`
  }
  return isSafeHref(href) ? href : null
}

/** The body's blocks, and what was left out of it. */
export function bodyBlocks(html: string, options: BodyOptions = {}): Body {
  const siteHost = options.siteHost ?? null
  const visible = withoutHidden(html)
  const expanded =
    options.shortcodes === false ? { html: visible, widgets: 0 } : expandShortcodes(visible)
  const builder = new BlockBuilder(options.title ?? null)
  let images = 0
  let skipping: { tag: string; depth: number } | null = null
  for (const [whole, closing, rawName, attributes = ""] of expanded.html.matchAll(TOKEN)) {
    const name = rawName?.toLowerCase()
    const open = !closing
    if (skipping) {
      if (name === skipping.tag && !whole.endsWith("/>")) {
        skipping.depth += open ? 1 : -1
      }
      if (skipping.depth === 0) {
        skipping = null
      }
      continue
    }
    if (!name) {
      if (!whole.startsWith("<")) {
        builder.text(whole)
      }
      continue
    }
    if (SKIPPED.has(name)) {
      images += name === "picture" && open ? 1 : 0
      if (open && !whole.endsWith("/>")) {
        skipping = { tag: name, depth: 1 }
      }
      continue
    }
    if (BREAKING.has(name)) {
      builder.flush()
      continue
    }
    const level = /^h([1-6])$/.exec(name)?.[1]
    if (level) {
      builder.headingAt(open ? Number(level) : null)
      continue
    }
    switch (name) {
      case "img":
        images += 1
        break
      case "br":
        builder.lineBreak()
        break
      case "strong":
      case "b":
        builder.mark("bold", open)
        break
      case "em":
      case "i":
        builder.mark("italic", open)
        break
      case "a": {
        const href = HREF.exec(attributes)
        builder.link(
          open ? (href ? hrefOf(href[1] ?? href[2] ?? href[3] ?? "", siteHost) : null) : undefined
        )
        break
      }
      case "ul":
      case "ol":
        if (open) {
          builder.openList(name === "ol", Number(START.exec(attributes)?.[1] ?? 1))
        } else {
          builder.closeList()
        }
        break
      case "li":
        builder.listItem(open)
        break
      case "blockquote":
        builder.blockquote(open)
        break
      case "table":
        if (open) {
          builder.openTable()
        } else {
          builder.closeTable()
        }
        break
      case "tr":
        builder.row(open)
        break
      case "td":
      case "th":
        builder.cell(open, name === "th")
        break
      default:
        break
    }
  }
  return { blocks: builder.end(), images, widgets: expanded.widgets }
}

// Within the document's bounds (lib/content DOC_LIMITS), with room to spare
const MAX_BLOCKS = 4_000
const MAX_TEXT_LENGTH = 180_000

const inlineText = (inlines: readonly Inline[] | undefined) =>
  (inlines ?? [])
    .map((node) => (node.type === "text" ? node.text : "\n"))
    .join("")
    .trim()

function itemLines(items: readonly ListItem[], marker: string): string[] {
  return items.flatMap((item) =>
    item.content.flatMap((child) =>
      child.type === "paragraph"
        ? [`${marker} ${inlineText(child.content)}`]
        : itemLines(child.content, "–")
    )
  )
}

/** A block as plain paragraphs: list items and table rows each their own. */
function plainOf(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return [inlineText(block.content)]
    case "bulletList":
      return itemLines(block.content, "•")
    case "orderedList":
      return itemLines(block.content, "•")
    case "blockquote":
      return block.content.flatMap((child) => plainOf(child))
    case "table":
      return block.content.map((row) => {
        const cells = row.content.map((cell) => inlineText(cell.content[0]?.content))
        return cells.length === 2 ? `${cells[0] ?? ""}: ${cells[1] ?? ""}` : cells.join(" | ")
      })
    case "image":
    case "productCard":
    case "categoryCard":
      return []
  }
}

/**
 * The body as plain text, as a product keeps its description: paragraphs
 * apart by a blank line, cut at a paragraph within `max`; and whether it
 * was cut.
 */
export function plainText(blocks: readonly Block[], max: number): { text: string; cut: boolean } {
  const lines = blocks.flatMap(plainOf).filter((line) => line.replace(/[•–:|\s]/g, "") !== "")
  let text = ""
  for (const line of lines) {
    const next = text === "" ? line : `${text}\n\n${line}`
    if (next.length > max) {
      return { text, cut: true }
    }
    text = next
  }
  return { text, cut: false }
}

/**
 * The blocks as a checked document, within its bounds: a body past them
 * is cut at a block (`cut`); one the check still refuses is kept as its
 * plain paragraphs.
 */
export function documentOf(blocks: readonly Block[]): { doc: ContentDoc; cut: boolean } {
  let length = 0
  const kept: Block[] = []
  for (const block of blocks.slice(0, MAX_BLOCKS)) {
    length += plainOf(block).join(" ").length
    if (length > MAX_TEXT_LENGTH) {
      break
    }
    kept.push(block)
  }
  const cut = kept.length < blocks.length
  const checked = contentDoc.safeParse({ type: "doc", content: kept })
  if (checked.success) {
    return { doc: checked.data, cut }
  }
  const { text } = plainText(kept, MAX_TEXT_LENGTH)
  const paragraphs: Block[] = text
    .split("\n\n")
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line.slice(0, 20_000) }],
    }))
  const plain = contentDoc.safeParse({ type: "doc", content: paragraphs })
  return { doc: plain.success ? plain.data : { type: "doc", content: [] }, cut: true }
}
