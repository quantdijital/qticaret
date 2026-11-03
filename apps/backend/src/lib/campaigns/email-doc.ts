import type { Block, ContentDoc, Inline } from "../content"
import type { ListItem, Paragraph } from "../content/doc"
import type { EmailBlock, EmailProductCard, EmailRun } from "../messaging/templates/layout"

/**
 * A campaign's content document (adr/0019) as e-mail blocks (adr/0050 §4):
 * headings, paragraphs with their emphasis and links, lists, images from
 * the shop's library, up to four product cards. A paragraph that is one
 * short link reads as a button. No HTML or CSS is written by anyone: the
 * layout draws each block with inline styles and escapes every value.
 */

export const MAX_PRODUCT_CARDS = 4
/** A linked paragraph up to this long is drawn as a button. */
const BUTTON_TEXT = 60

export interface DocContext {
  /** The link as the message carries it (absolute, with utm); null keeps the text, drops the link. */
  link: (href: string) => string | null
  /** The shop's details in place of their `{belirteç}`s. */
  fill: (text: string) => string
  products: ReadonlyMap<string, EmailProductCard>
  categories: ReadonlyMap<string, { title: string; url: string | null }>
}

function runsOf(content: readonly Inline[] | undefined, context: DocContext): EmailRun[] {
  return (content ?? []).map((node): EmailRun => {
    if (node.type === "hardBreak") {
      return { text: "\n" }
    }
    const href = node.marks?.find((mark) => mark.type === "link")?.attrs.href
    return {
      text: context.fill(node.text),
      ...(node.marks?.some((mark) => mark.type === "bold") ? { bold: true } : {}),
      ...(node.marks?.some((mark) => mark.type === "italic") ? { italic: true } : {}),
      ...(href ? { href: context.link(href) } : {}),
    }
  })
}

const plain = (runs: readonly EmailRun[]): string =>
  runs
    .map((run) => run.text)
    .join("")
    .trim()

function paragraphBlock(node: Paragraph, context: DocContext): EmailBlock | null {
  const runs = runsOf(node.content, context)
  const text = plain(runs)
  if (text === "") {
    return null
  }
  const [first] = runs
  const oneLink =
    first?.href && runs.every((run) => run.href === first.href) && text.length <= BUTTON_TEXT
  return oneLink ? { kind: "button", label: text, url: first.href ?? null } : { kind: "rich", runs }
}

/** A list item's text: its paragraphs, and a nested list's items as lines under it. */
function itemRuns(item: ListItem, context: DocContext): EmailRun[] {
  const runs: EmailRun[] = []
  for (const child of item.content) {
    if (runs.length > 0) {
      runs.push({ text: "\n" })
    }
    if (child.type === "paragraph") {
      runs.push(...runsOf(child.content, context))
    } else {
      child.content.forEach((nested, index) => {
        runs.push(...(index > 0 ? [{ text: "\n" }] : []), { text: "– " })
        runs.push(...itemRuns(nested, context))
      })
    }
  }
  return runs
}

function blocksOf(node: Block, context: DocContext): EmailBlock[] {
  switch (node.type) {
    case "paragraph": {
      const block = paragraphBlock(node, context)
      return block ? [block] : []
    }
    case "heading": {
      const text = plain(runsOf(node.content, context))
      return text ? [{ kind: "heading", text }] : []
    }
    case "bulletList":
    case "orderedList":
      return [
        {
          kind: "list",
          ordered: node.type === "orderedList",
          items: node.content.map((item) => itemRuns(item, context)),
        },
      ]
    case "blockquote":
      return node.content.flatMap((child) => blocksOf(child, context))
    case "table":
      return node.content.flatMap((row): EmailBlock[] => {
        const cells = row.content.map((cell) =>
          cell.content.map((paragraph) => plain(runsOf(paragraph.content, context))).join(" ")
        )
        const text = cells.filter(Boolean).join(" · ")
        return text ? [{ kind: "rich", runs: [{ text }] }] : []
      })
    case "image":
      return [{ kind: "image", src: node.attrs.src, alt: node.attrs.alt ?? "" }]
    case "productCard": {
      const card = context.products.get(node.attrs.id)
      return card ? [{ kind: "products", cards: [card] }] : []
    }
    case "categoryCard": {
      const category = context.categories.get(node.attrs.id)
      return category ? [{ kind: "button", label: category.title, url: category.url }] : []
    }
  }
}

/** The document's blocks; product cards side by side join one table, four at most. */
export function emailBlocksOf(doc: ContentDoc, context: DocContext): EmailBlock[] {
  const blocks: EmailBlock[] = []
  let cards = 0
  for (const node of doc.content) {
    for (const block of blocksOf(node, context)) {
      const last = blocks.at(-1)
      if (block.kind === "products") {
        if (cards >= MAX_PRODUCT_CARDS) {
          continue
        }
        cards += block.cards.length
        if (last?.kind === "products") {
          last.cards.push(...block.cards)
          continue
        }
      }
      blocks.push(block)
    }
  }
  return blocks
}

const mapRuns = (runs: readonly EmailRun[], fill: (text: string) => string): EmailRun[] =>
  runs.map((run) => ({ ...run, text: fill(run.text) }))

/** The blocks with every text written by the shop passed through `fill` (the recipient's name). */
export function mapBlockTexts(
  blocks: readonly EmailBlock[],
  fill: (text: string) => string
): EmailBlock[] {
  return blocks.map((block): EmailBlock => {
    switch (block.kind) {
      case "heading":
      case "paragraph":
      case "note":
        return { ...block, text: fill(block.text) }
      case "rich":
        return { ...block, runs: mapRuns(block.runs, fill) }
      case "list":
        return { ...block, items: block.items.map((item) => mapRuns(item, fill)) }
      case "button":
        return { ...block, label: fill(block.label) }
      case "image":
      case "products":
      case "items":
      case "summary":
      case "details":
        return block
    }
  })
}
