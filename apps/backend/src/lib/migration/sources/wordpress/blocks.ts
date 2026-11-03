import type {
  Block,
  BulletList,
  Inline,
  ListItem,
  Mark,
  OrderedList,
  Paragraph,
} from "../../../content/doc"
import { decodeEntities } from "../../text"
import { TableDraft, tidy } from "./tables"

/**
 * The content document's blocks built as an HTML body's tags come
 * (`html.ts` reads them): running text with its marks, headings at the
 * top level, lists (nested up to three deep), quotes and tables within the
 * document's bounds. Pure state; nothing here reads markup.
 */

// Invisible format characters and controls: no text a page shows
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\p{Cf}\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu
// A text node's cap in the document
const MAX_TEXT = 20_000
const MAX_LIST_DEPTH = 3
const MAX_QUOTED = 200

type Nestable = Paragraph | BulletList | OrderedList

interface ListFrame {
  list: BulletList | OrderedList
  item: ListItem | null
}

const sameWords = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr")

const textOfInlines = (inlines: readonly Inline[]) =>
  inlines.map((node) => (node.type === "text" ? node.text : " ")).join("")

export class BlockBuilder {
  readonly blocks: Block[] = []
  private inlines: Inline[] = []
  private heading: 2 | 3 | 4 | null = null
  private quote: Nestable[] | null = null
  private quoteDepth = 0
  private readonly lists: ListFrame[] = []
  private table: TableDraft | null = null
  private bold = 0
  private italic = 0
  private readonly links: (string | null)[] = []

  /** `title`: the page's own, a heading that only repeats it is left out. */
  constructor(private readonly title: string | null) {}

  private get into(): Inline[] {
    return this.table?.inlines ?? this.inlines
  }

  private marks(): Mark[] {
    const own: Mark[] = []
    if (this.bold > 0) {
      own.push({ type: "bold" })
    }
    if (this.italic > 0) {
      own.push({ type: "italic" })
    }
    const href = this.links.findLast((link) => link !== null)
    if (href) {
      own.push({ type: "link", attrs: { href } })
    }
    return own
  }

  /** Text as HTML shows it: entities read, every run of spaces one space. */
  text(raw: string): void {
    if (this.table && !this.table.inlines) {
      return
    }
    const into = this.into
    const previous = into.at(-1)
    let text = decodeEntities(raw).replace(INVISIBLE, "").replace(/\s+/g, " ")
    if (previous === undefined || previous.type === "hardBreak" || previous.text.endsWith(" ")) {
      text = text.replace(/^ /, "")
    }
    if (text === "") {
      return
    }
    const own = this.marks()
    if (
      previous?.type === "text" &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(own) &&
      previous.text.length + text.length <= MAX_TEXT
    ) {
      into[into.length - 1] = { ...previous, text: previous.text + text }
      return
    }
    for (let start = 0; start < text.length; start += MAX_TEXT) {
      const part = text.slice(start, start + MAX_TEXT)
      into.push(
        own.length > 0 ? { type: "text", text: part, marks: own } : { type: "text", text: part }
      )
    }
  }

  lineBreak(): void {
    if (this.heading) {
      this.text(" ")
    } else {
      this.into.push({ type: "hardBreak" })
    }
  }

  mark(kind: "bold" | "italic", open: boolean): void {
    this[kind] = Math.max(0, this[kind] + (open ? 1 : -1))
  }

  /** A link's start (its safe href, or none: the text stays plain) or its end. */
  link(href: string | null | undefined): void {
    if (href === undefined) {
      this.links.pop()
    } else {
      this.links.push(href)
    }
  }

  private place(block: Block): void {
    const frame = this.lists.at(-1)
    const nestable = block.type === "paragraph" || block.type.endsWith("List")
    if (frame?.item && nestable) {
      frame.item.content.push(block as Nestable)
    } else if (this.quote && nestable) {
      this.quote.push(block as Nestable)
    } else {
      this.blocks.push(block)
    }
  }

  /** Ends the running text: a heading at the top, else a paragraph where it stands. */
  flush(): void {
    const cell = this.table?.inlines
    if (cell) {
      if (cell.length > 0) {
        cell.push({ type: "hardBreak" })
      }
      return
    }
    const content = tidy(this.inlines)
    this.inlines = []
    if (content.length === 0) {
      return
    }
    if (this.heading && this.lists.length === 0 && !this.quote) {
      if (!(this.title && sameWords(textOfInlines(content), this.title))) {
        this.blocks.push({ type: "heading", attrs: { level: this.heading }, content })
      }
      return
    }
    this.place({ type: "paragraph", content })
  }

  /** An h1–h6 opening or closing: h1 and h2 are the document's h2, h5 and h6 its h4. */
  headingAt(level: number | null): void {
    this.flush()
    this.heading = level === null ? null : level <= 2 ? 2 : level === 3 ? 3 : 4
  }

  openList(ordered: boolean, start: number): void {
    this.flush()
    if (this.table?.inlines || this.lists.length >= MAX_LIST_DEPTH) {
      return
    }
    this.lists.push({
      list: ordered
        ? { type: "orderedList", ...(start !== 1 ? { attrs: { start } } : {}), content: [] }
        : { type: "bulletList", content: [] },
      item: null,
    })
  }

  private closeItem(frame: ListFrame): void {
    this.flush()
    if (frame.item && frame.item.content.length > 0 && frame.list.content.length < 500) {
      frame.list.content.push(frame.item)
    }
    frame.item = null
  }

  closeList(): void {
    if (this.table?.inlines) {
      this.flush()
      return
    }
    const frame = this.lists.pop()
    if (!frame) {
      this.flush()
      return
    }
    this.closeItem(frame)
    if (frame.list.content.length > 0) {
      this.place(frame.list)
    }
  }

  listItem(open: boolean): void {
    const frame = this.lists.at(-1)
    if (!frame || this.table?.inlines) {
      this.flush()
      return
    }
    this.closeItem(frame)
    if (open) {
      frame.item = { type: "listItem", content: [] }
    }
  }

  blockquote(open: boolean): void {
    this.flush()
    if (open) {
      this.quoteDepth += 1
      this.quote ??= []
      return
    }
    if (this.quoteDepth === 0) {
      return
    }
    this.quoteDepth -= 1
    if (this.quoteDepth === 0 && this.quote) {
      const content = this.quote.slice(0, MAX_QUOTED)
      this.quote = null
      if (content.length > 0) {
        this.place({ type: "blockquote", content })
      }
    }
  }

  openTable(): void {
    if (!this.table) {
      this.flush()
      this.table = new TableDraft()
    }
  }

  /** A row's start or end. */
  row(open: boolean): void {
    this.table?.rowAt(open)
  }

  cell(open: boolean, header: boolean): void {
    this.table?.cellAt(open, header)
  }

  closeTable(): void {
    const table = this.table?.finish()
    this.table = null
    if (table) {
      this.place(table)
    }
  }

  /** Whatever the body left open, closed; the blocks. */
  end(): Block[] {
    this.closeTable()
    while (this.lists.length > 0) {
      this.closeList()
    }
    this.flush()
    while (this.quoteDepth > 0) {
      this.blockquote(false)
    }
    return this.blocks
  }
}
