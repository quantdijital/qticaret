import { z } from "@medusajs/framework/zod"
import { contentDoc } from "./doc"
import type { ContentDoc } from "./doc"

/**
 * A footer text block's document (adr/0070 §2): the content document
 * (adr/0019) narrowed to what a footer column carries. Only paragraphs,
 * line breaks and lists (bold, italic and links as marks); a heading (the
 * block's own title is the footer's heading level), a card, a picture, a
 * quote or a table is refused. Small, since every page draws it.
 *
 * `FOOTER_DOC_LIMITS` mirrors `@qticaret/types`' `FOOTER_ROWS_LIMITS`
 * (`textNodes`, `textChars`, `textDepth`); a unit test keeps them equal.
 */
export const FOOTER_DOC_LIMITS = { nodes: 200, textLength: 1500, depth: 4 } as const

export const FOOTER_NODES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
])

interface Node {
  type?: unknown
  text?: unknown
  content?: unknown
}

/** A narrowed document's bounds: its nodes, its characters of text, its depth. */
export interface BareDocLimits {
  nodes: number
  textLength: number
  depth: number
}

/**
 * Whether a checked document fits a footer column: every node on the
 * list, and the whole within the bounds (the document itself is depth 0,
 * so a one-level list's text sits at 4).
 */
export const fitsFooter = (doc: ContentDoc): boolean => fitsBare(doc, FOOTER_DOC_LIMITS)

/**
 * Whether a checked document holds only paragraphs, line breaks and lists
 * (bold, italic and links as marks) within `limits`: a footer block's
 * text, an FAQ's answer (adr/0073 Ek 2026-11-24 (2)).
 */
export const fitsBare = (doc: ContentDoc, limits: BareDocLimits): boolean =>
  fitsNarrowDoc(doc, FOOTER_NODES, limits)

/** The bounds under the name a program step's narrowing uses (adr/0078). */
export type NarrowDocLimits = BareDocLimits

/**
 * Whether a checked document holds only the nodes on a list, within
 * bounds: a footer column's, a program step's (adr/0078). A loop with its
 * own stack, as the content document's own bounds.
 */
export function fitsNarrowDoc(
  doc: ContentDoc,
  allowed: ReadonlySet<string>,
  limits: NarrowDocLimits
): boolean {
  const stack: [Node, number][] = [[doc, 0]]
  let nodes = 0
  let text = 0
  for (let item = stack.pop(); item; item = stack.pop()) {
    const [node, depth] = item
    nodes += 1
    text += typeof node.text === "string" ? node.text.length : 0
    if (
      typeof node.type !== "string" ||
      !allowed.has(node.type) ||
      nodes > limits.nodes ||
      text > limits.textLength ||
      depth > limits.depth
    ) {
      return false
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content as Node[]) {
        stack.push([child, depth + 1])
      }
    }
  }
  return true
}

/** A footer text block's body as the editor sent it: a content document that fits a column. */
export const footerDoc = z.unknown().transform((value, ctx): ContentDoc => {
  const parsed = contentDoc.safeParse(value)
  if (!parsed.success || !fitsFooter(parsed.data)) {
    ctx.addIssue({ code: "custom", message: "storefront_layout.footer_block_invalid" })
    return z.NEVER
  }
  return parsed.data
})
