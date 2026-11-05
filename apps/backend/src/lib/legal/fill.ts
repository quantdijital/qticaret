import type { Block, ContentDoc, Inline } from "../content"
import { BLOCK_TOKENS } from "./tokens"

/** What a token is filled with; one without a value shows as this, never as `{name}`. */
export const MISSING_VALUE = "—"

export interface LegalValues {
  /** Text tokens by name. */
  text: Readonly<Record<string, string | null | undefined>>
  /** Block tokens by name (the order's lines as a table). */
  blocks?: Readonly<Record<string, readonly Block[]>>
}

const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu

// Control and format characters (a right-to-left override in a name) would
// make a contract read otherwise than it says: a filled value drops them.
// A tab or a line break between words stays a space, so they never run together.
const INVISIBLE = /(?!\s)[\p{Cc}\p{Cf}]/gu
const SPACES = /\s+/gu

const fillText = (text: string, values: LegalValues["text"]): string =>
  text.replace(TOKEN, (_whole, name: string) => {
    const value = values[name]?.replace(INVISIBLE, "").replace(SPACES, " ").trim()
    if (!value) {
      return MISSING_VALUE
    }
    return value
  })

function fillInlines(content: readonly Inline[] | undefined, values: LegalValues["text"]) {
  return content?.map((node) =>
    node.type === "text" ? { ...node, text: fillText(node.text, values) } : node
  )
}

// A paragraph holding one block token and nothing else
function blockTokenOf(block: Block): string | null {
  if (block.type !== "paragraph" || block.content?.length !== 1) {
    return null
  }
  const [only] = block.content
  const name = only?.type === "text" ? /^\s*\{([\p{L}\p{N}_]+)\}\s*$/u.exec(only.text)?.[1] : null
  return name && BLOCK_TOKENS.has(name) ? name : null
}

// A block token opens only at the top: a table never lands in a list item or a cell
function fillBlocks(blocks: readonly Block[], values: LegalValues, top = true): Block[] {
  return blocks.flatMap((block): Block[] => {
    const token = top ? blockTokenOf(block) : null
    if (token) {
      const filled = values.blocks?.[token]
      return filled?.length
        ? [...filled]
        : [{ type: "paragraph", content: [{ type: "text", text: MISSING_VALUE }] }]
    }
    if (block.type === "paragraph" || block.type === "heading") {
      return [{ ...block, content: fillInlines(block.content, values.text) }] as Block[]
    }
    const content = (block as { content?: unknown }).content
    return Array.isArray(content)
      ? [{ ...block, content: fillBlocks(content as Block[], values, false) } as Block]
      : [block]
  })
}

/**
 * The text with its tokens filled (adr/0041 §1): text tokens in place,
 * a block token's paragraph by its blocks. The document's own structure is
 * kept, so the server's renderer still decides every tag.
 */
export function fillLegalDoc(doc: ContentDoc, values: LegalValues): ContentDoc {
  return { type: "doc", content: fillBlocks(doc.content, values) }
}
