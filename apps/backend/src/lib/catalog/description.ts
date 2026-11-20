import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../content/doc"
import type { Block, ContentDoc } from "../content/doc"
import { docPlainText, hasText } from "../content/plain"

/**
 * A product's long description as a content document (adr/0055, the
 * adr/0019 model): headings, paragraphs, lists, quotes and tables with
 * bold, italic and safe links, within a page's bounds. Pictures and
 * product or category cards are a page's, not a description's: the
 * product's own pictures are its gallery. `product.description` keeps the
 * document's plain text, written by the server whenever the document is.
 */

/** A document as the extension's `description_doc` column holds it. */
// A type, not an interface: the column's JSON type takes it only with an implicit index signature
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type DescriptionDoc = { type: "doc"; content: Block[] }

/** The plain text's cap: the catalog sheet's description cell takes as much (lib/catalog-sheet). */
export const DESCRIPTION_TEXT_MAX = 20_000

const NOT_IN_A_DESCRIPTION: ReadonlySet<string> = new Set(["image", "productCard", "categoryCard"])

/**
 * A description document as the panel's editor sends it: the content
 * checks, then no picture or card (`blocksMessage` the refusal's key).
 */
export const descriptionDocSchema = (blocksMessage: string) =>
  z.unknown().transform((value, ctx): ContentDoc => {
    const parsed = contentDoc.safeParse(value)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path })
      }
      return z.NEVER
    }
    if (parsed.data.content.some((block) => NOT_IN_A_DESCRIPTION.has(block.type))) {
      ctx.addIssue({ code: "custom", message: blocksMessage })
      return z.NEVER
    }
    return parsed.data
  })

/** A product's description document: its pictures are its gallery. */
export const productDescriptionDoc = descriptionDocSchema("catalog.description_blocks")

/** The plain text a product keeps for its document. */
export const descriptionTextOf = (doc: ContentDoc): string =>
  docPlainText(doc, DESCRIPTION_TEXT_MAX).text

/**
 * What a description save writes (adr/0055): a document with text is
 * kept and its plain text becomes the description; one without text
 * clears both; null drops the document and keeps the description. Only
 * what changes: `doc` undefined leaves the document, `description`
 * undefined the product's text.
 */
export function descriptionChanges(
  asked: ContentDoc | null | undefined,
  current: { doc: unknown; description: string | null }
): { doc?: ContentDoc | null; description?: string } {
  if (asked === undefined) {
    return {}
  }
  const hadDoc = current.doc !== null && current.doc !== undefined
  if (asked === null || !hasText(asked)) {
    return {
      ...(hadDoc ? { doc: null } : {}),
      ...(asked !== null && (current.description ?? "") !== "" ? { description: "" } : {}),
    }
  }
  const text = descriptionTextOf(asked)
  return { doc: asked, ...(text !== (current.description ?? "") ? { description: text } : {}) }
}
