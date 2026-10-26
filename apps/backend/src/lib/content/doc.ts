import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../security/text"

/**
 * Rich text as a document, not HTML (adr/0019): the ProseMirror JSON the
 * panel's editor writes, held to an allowlist. A node or mark outside it is
 * refused on save; attributes outside it are dropped. The server renders
 * the HTML itself (`render.ts`), so nothing a writer types becomes markup.
 */

export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } }

export interface TextNode {
  type: "text"
  text: string
  marks?: Mark[] | undefined
}

export interface HardBreak {
  type: "hardBreak"
}

export type Inline = TextNode | HardBreak

export interface Paragraph {
  type: "paragraph"
  content?: Inline[] | undefined
}

export interface Heading {
  type: "heading"
  attrs: { level: 2 | 3 | 4 }
  content?: Inline[] | undefined
}

export interface ListItem {
  type: "listItem"
  content: (Paragraph | BulletList | OrderedList)[]
}

export interface BulletList {
  type: "bulletList"
  content: ListItem[]
}

export interface OrderedList {
  type: "orderedList"
  attrs?: { start?: number | undefined } | undefined
  content: ListItem[]
}

export interface Blockquote {
  type: "blockquote"
  content: (Paragraph | BulletList | OrderedList)[]
}

export interface TableCell {
  type: "tableCell" | "tableHeader"
  attrs?: { colspan?: number | undefined; rowspan?: number | undefined } | undefined
  content: Paragraph[]
}

export interface TableRow {
  type: "tableRow"
  content: TableCell[]
}

export interface Table {
  type: "table"
  content: TableRow[]
}

/** Only from the shop's own media library; the save checks the address (`workflows/content/rules.ts`). */
export interface Image {
  type: "image"
  attrs: { src: string; alt?: string | null | undefined }
}

/** A product or category card (short code), rendered from the record as it is now. */
export interface Card {
  type: "productCard" | "categoryCard"
  attrs: { id: string }
}

export type Block =
  Paragraph | Heading | BulletList | OrderedList | Blockquote | Table | Image | Card

export interface ContentDoc {
  type: "doc"
  content: Block[]
}

export const EMPTY_DOC: ContentDoc = { type: "doc", content: [] }

// Bounds that keep a document a page, not a payload
export const DOC_LIMITS = { nodes: 20_000, depth: 12, textLength: 200_000 } as const

const ABSOLUTE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
// A path on the shop: one leading slash, no protocol-relative `//`, no backslash or control characters
const SITE_PATH = /^\/(?!\/)[^\s\\]*$/
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/
// Invisible format characters (bidi overrides) make an address read as another
const FORMAT = /\p{Cf}/u

/** A link a reader may follow: http(s) elsewhere (no `user@` in it), or a path on the shop. */
export function isSafeHref(href: string): boolean {
  if (CONTROL.test(href) || FORMAT.test(href)) {
    return false
  }
  if (SITE_PATH.test(href)) {
    return true
  }
  if (!ABSOLUTE.test(href)) {
    return false
  }
  try {
    const url = new URL(href)
    return url.username === "" && url.password === ""
  } catch {
    return false
  }
}

const href = z.string().trim().min(1).max(2048).refine(isSafeHref)
const clean = (text: string) => isCleanText(text, true)

const mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href }) }),
])

const inline = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().min(1).max(20_000).refine(clean),
    marks: z.array(mark).max(3).optional(),
  }),
  z.object({ type: z.literal("hardBreak") }),
])

const inlines = z.array(inline).max(2_000).optional()

const paragraph = z.object({ type: z.literal("paragraph"), content: inlines })

// Each node is checked against the one shape its `type` names, never tried against
// every shape in turn: nested lists would otherwise cost twice as much per level
const listChild: z.ZodType<ListItem["content"][number]> = z.lazy(() =>
  z.discriminatedUnion("type", [paragraph, bulletList, orderedList])
)

const listItem: z.ZodType<ListItem> = z.object({
  type: z.literal("listItem"),
  content: z.array(listChild).min(1).max(200),
})

const bulletList = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItem).min(1).max(500),
})

const orderedList = z.object({
  type: z.literal("orderedList"),
  attrs: z.object({ start: z.number().int().min(0).max(100_000).optional() }).optional(),
  content: z.array(listItem).min(1).max(500),
})

const span = z.number().int().min(1).max(50).optional()

const tableCell = z.object({
  type: z.enum(["tableCell", "tableHeader"]),
  attrs: z.object({ colspan: span, rowspan: span }).optional(),
  content: z.array(paragraph).min(1).max(50),
})

const cardId = z.object({ id: z.string().regex(/^[a-z]+_[0-9A-Z]{26}$/) })

const block = z.discriminatedUnion("type", [
  paragraph,
  z.object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
    content: inlines,
  }),
  bulletList,
  orderedList,
  z.object({
    type: z.literal("blockquote"),
    content: z
      .array(z.discriminatedUnion("type", [paragraph, bulletList, orderedList]))
      .min(1)
      .max(200),
  }),
  z.object({
    type: z.literal("table"),
    content: z
      .array(z.object({ type: z.literal("tableRow"), content: z.array(tableCell).min(1).max(30) }))
      .min(1)
      .max(500),
  }),
  z.object({
    type: z.literal("image"),
    attrs: z.object({
      src: z.string().max(2048).regex(ABSOLUTE),
      alt: z.string().trim().max(500).refine(clean).nullable().optional(),
    }),
  }),
  z.object({ type: z.literal("productCard"), attrs: cardId }),
  z.object({ type: z.literal("categoryCard"), attrs: cardId }),
])

const docShape = z.object({ type: z.literal("doc"), content: z.array(block).max(5_000) })

/**
 * Whether a document as sent is past its bounds, measured before it is
 * parsed: a loop with its own stack, so no depth of nesting costs more than
 * its nodes, and it stops at the first bound crossed.
 */
function pastBounds(value: unknown): boolean {
  const stack: [unknown, number][] = [[value, 0]]
  let nodes = 0
  let text = 0
  for (let item = stack.pop(); item; item = stack.pop()) {
    const [node, depth] = item
    if (typeof node !== "object" || node === null) {
      continue
    }
    nodes += 1
    const { text: own, content } = node as { text?: unknown; content?: unknown }
    text += typeof own === "string" ? own.length : 0
    if (nodes > DOC_LIMITS.nodes || depth > DOC_LIMITS.depth || text > DOC_LIMITS.textLength) {
      return true
    }
    if (Array.isArray(content)) {
      for (const child of content as unknown[]) {
        stack.push([child, depth + 1])
      }
    }
  }
  return false
}

/** A document as the editor sent it, checked against the bounds and then the allowlist. */
export const contentDoc = z.unknown().transform((value, ctx): ContentDoc => {
  if (pastBounds(value)) {
    ctx.addIssue({ code: "custom", message: "content.too_large" })
    return z.NEVER
  }
  const parsed = docShape.safeParse(value)
  if (!parsed.success) {
    const [first] = parsed.error.issues
    ctx.addIssue({ code: "custom", message: "content.body_invalid", path: first?.path ?? [] })
    return z.NEVER
  }
  return parsed.data
})
