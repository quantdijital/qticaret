import { lineAddonsOf } from "../catalog/addons"
import type { Block, ContentDoc } from "../content"
import { PERSONAL_LINES_TOKEN } from "./tokens"

/*
 * Lines made to the buyer's wish in an order's contracts (adr/0052 §8): the
 * pre-information form and the distance sales contract name each line an
 * add-on put outside the right of withdrawal, in their withdrawal clause.
 * The server places the block there, whether or not the shop's text was
 * written before add-ons.
 */

/**
 * TASLAK, avukat onayı bekler (docs/12, adr/0041 §1): the one sentence the
 * platform adds to the shop's contracts, as the starters' drafts are.
 */
const PERSONAL_LINES_SENTENCE =
  "Aşağıdaki ürünler alıcının istekleri doğrultusunda kişiye özel hazırlandığından, Mesafeli Sözleşmeler Yönetmeliği md. 15/1-ç uyarınca bu ürünlerde cayma hakkı kullanılamaz:"

const paragraph = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})

/** A contract line as the clause names it: the product, and the pick that makes it personal. */
export interface PersonalLineFacts {
  title: string
  metadata?: unknown
}

/**
 * The clause's blocks for the order's personal lines: the sentence, then
 * each line with its picks ("Çakı · Standart (Ürün üzerine yazı: Ada)");
 * none for an order without any.
 */
export function personalLinesBlocks(lines: readonly PersonalLineFacts[]): Block[] {
  const named = lines.flatMap((line) => {
    const addons = lineAddonsOf(line.metadata)
    if (!addons?.non_withdrawable) {
      return []
    }
    const picks = addons.items
      .filter((item) => item.non_withdrawable)
      .map(
        (item) =>
          `${item.label}: ${(item.kind === "choice" ? item.choice_label : item.value) ?? ""}`
      )
    return [picks.length ? `${line.title} (${picks.join("; ")})` : line.title]
  })
  if (named.length === 0) {
    return []
  }
  return [
    paragraph(PERSONAL_LINES_SENTENCE),
    {
      type: "bulletList",
      content: named.map((text) => ({ type: "listItem", content: [paragraph(text)] })),
    },
  ]
}

const headingText = (block: Block): string =>
  block.type === "heading"
    ? (block.content ?? [])
        .map((node) => (node.type === "text" ? node.text : " "))
        .join("")
        .toLocaleLowerCase("tr")
    : ""

/**
 * The text with the personal lines' token at the end of its withdrawal
 * clause: the section under the first heading that names "cayma", up to
 * the next heading of its level or above; at the end of the text when it
 * has no such heading. The text as it was when there are no such lines.
 */
export function withPersonalLines(
  doc: ContentDoc,
  blocks: Readonly<Record<string, readonly Block[]>>
): ContentDoc {
  if (!blocks[PERSONAL_LINES_TOKEN]?.length) {
    return doc
  }
  const content = [...doc.content]
  const start = content.findIndex((block) => headingText(block).includes("cayma"))
  const level = (block: Block | undefined) => (block?.type === "heading" ? block.attrs.level : 0)
  const next =
    start < 0
      ? -1
      : content.findIndex(
          (block, index) =>
            index > start && block.type === "heading" && level(block) <= level(content[start])
        )
  const at = start < 0 || next < 0 ? content.length : next
  content.splice(at, 0, paragraph(`{${PERSONAL_LINES_TOKEN}}`))
  return { ...doc, content }
}
