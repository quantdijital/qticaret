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

// The note's own words, which no shop's text has: a draft that still holds them is not published
const NOTE_MARK = "bir başlangıç iskeletidir"

/** The day the drafts were last checked against the law in force (docs/yasal-metinler.md). */
export const CHECKED_ON = "3 Kasım 2026"

/**
 * The draft note a starter opens with, its one block: it says the text is
 * a draft, the law it was checked against, and the points for the shop's
 * lawyer to settle. Deleted once a lawyer has read the text; until then
 * the text is not published (`legal.draft_note_present`).
 */
export function draftNote(questions: readonly string[]): Block {
  return {
    type: "blockquote",
    content: [
      p(
        `TASLAK: Bu metin ${NOTE_MARK}, hukuki görüş değildir. Yayımlamadan önce avukatınıza kontrol ettirin ve bu notu silin.`
      ),
      p(
        `Metin, ${CHECKED_ON} tarihinde yürürlükte olan mevzuata göre hazırlanmıştır. Süslü parantez içindeki belirteçler, gösterilirken mağaza ayarlarındaki ve siparişteki bilgilerle dolar; künyesi eksik olan bilgi metinde "—" olarak görünür.`
      ),
      p("Avukatınızla karara bağlamanız gereken noktalar:"),
      numbered(questions),
      p(
        "Bu kutunun tamamını sildiğinizde metin yayımlanabilir. Kutunun dışındaki metin olduğu gibi yayımlanır."
      ),
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

/**
 * Whether a text still holds its starter's draft note (F13.7), anywhere,
 * edited or not: such a text is not published (`legal.draft_note_present`).
 */
export function hasStarterNote(doc: ContentDoc): boolean {
  return blockTexts(doc).some((words) => words.includes(NOTE_MARK))
}
