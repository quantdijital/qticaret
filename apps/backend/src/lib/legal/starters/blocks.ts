import type { Block, ContentDoc } from "../../content"
import type { BulletList, ListItem, OrderedList, Paragraph, TableRow } from "../../content/doc"

/**
 * The pieces the starting drafts are written with (F13.7, adr/0041 §1):
 * headings, paragraphs, lists and tables of the content document
 * (adr/0019), and the draft note each opens with.
 */

const text = (value: string) => ({ type: "text" as const, text: value })

export const h2 = (value: string): Block => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
})

export const h3 = (value: string): Block => ({
  type: "heading",
  attrs: { level: 3 },
  content: [text(value)],
})

export const p = (value: string): Paragraph => ({ type: "paragraph", content: [text(value)] })

/** A paragraph with one link in it: the words before, the link, the words after. */
export const linked = (before: string, label: string, href: string, after: string): Paragraph => ({
  type: "paragraph",
  content: [
    text(before),
    { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] },
    text(after),
  ],
})

const items = (values: readonly string[]): ListItem[] =>
  values.map((value) => ({ type: "listItem", content: [p(value)] }))

export const bullets = (values: readonly string[]): BulletList => ({
  type: "bulletList",
  content: items(values),
})

export const numbered = (values: readonly string[]): OrderedList => ({
  type: "orderedList",
  content: items(values),
})

const row = (cells: readonly string[], header = false): TableRow => ({
  type: "tableRow",
  content: cells.map((cell) => ({
    type: header ? "tableHeader" : "tableCell",
    content: [p(cell)],
  })),
})

/** A table: its header row, then its rows. */
export const table = (header: readonly string[], rows: readonly (readonly string[])[]): Block => ({
  type: "table",
  content: [row(header, true), ...rows.map((cells) => row(cells))],
})

// The note's own words, which no shop's text has. Drafts saved before
// 2026-11-04 carry the note's older wording with the same words.
const NOTE_MARK = "bir başlangıç iskeletidir"

/** The day the drafts were last checked against the law in force (docs/yasal-metinler.md). */
export const CHECKED_ON = "3 Kasım 2026"

/**
 * The draft note a starter opens with, its one block: it says the text is
 * a draft, the law it was checked against, and the points worth checking
 * with the shop's lawyer. It is for the shop alone: publishing removes it
 * (`withoutStarterNote`; the owner, 2026-11-04), so a shopper never reads it.
 */
export function draftNote(questions: readonly string[]): Block {
  return {
    type: "blockquote",
    content: [
      p(
        `TASLAK: Bu metin ${NOTE_MARK}, hukuki görüş değildir. Bu kutu yalnızca mağazanız içindir: metni yayımladığınızda kendiliğinden kaldırılır, müşterileriniz görmez.`
      ),
      p(
        `Metin, ${CHECKED_ON} tarihinde yürürlükte olan mevzuata göre hazırlanmıştır. Süslü parantez içindeki belirteçler, gösterilirken mağaza ayarlarındaki ve siparişteki bilgilerle dolar; künyesi eksik olan bilgi metinde "—" olarak görünür.`
      ),
      p("Avukatınızla kontrol etmeye değer noktalar:"),
      numbered(questions),
      p("Kutunun dışındaki metin olduğu gibi yayımlanır."),
    ],
  }
}

// Each paragraph's or heading's words as a reader reads them: its text pieces
// joined (a bold word splits the text) and its spaces as one
function blockTexts(node: unknown): string[] {
  const { type, content } = (node ?? {}) as { type?: unknown; content?: unknown }
  if (!Array.isArray(content)) {
    return []
  }
  if (type === "paragraph" || type === "heading") {
    const words = content
      .map((inline) => {
        const { text: value } = (inline ?? {}) as { text?: unknown }
        return typeof value === "string" ? value : " "
      })
      .join("")
    return [words.replace(/\s+/g, " ").toLocaleLowerCase("tr")]
  }
  return content.flatMap(blockTexts)
}

const holdsMark = (node: unknown): boolean =>
  blockTexts(node).some((words) => words.includes(NOTE_MARK))

/** Whether a text still holds its starter's draft note (F13.7), anywhere, edited or not. */
export function hasStarterNote(doc: ContentDoc): boolean {
  return holdsMark(doc)
}

/**
 * The text as it is published (the owner, 2026-11-04): every box that
 * holds the starter's draft note removed, whole, edited or not; nothing
 * else changes. A box is only ever a top-level block (adr/0019). The same
 * document comes back when there is no note box.
 */
export function withoutStarterNote(doc: ContentDoc): ContentDoc {
  const content = doc.content.filter((block) => !(block.type === "blockquote" && holdsMark(block)))
  return content.length === doc.content.length ? doc : { ...doc, content }
}
