import type { Block, ContentDoc, Inline, ListItem, Mark, Paragraph, TableCell } from "./doc"

/** What a card short code shows: the record's name and its storefront path, as they are now. */
export interface CardTarget {
  title: string
  path: string
}

/** A library image's measured size in pixels (its media record). */
export interface ImageSize {
  width: number
  height: number
}

/** The cards' records, by id; one missing (unpublished, deleted) leaves its card out. */
export interface CardTargets {
  product: ReadonlyMap<string, CardTarget>
  category: ReadonlyMap<string, CardTarget>
  /**
   * The pictures' sizes by address, from the media library: printed as
   * `width`/`height`, so the page keeps their room before they load (CLS,
   * docs/21 2026-11-06, 8). One the library has not measured goes without.
   */
  images?: ReadonlyMap<string, ImageSize>
}

export const NO_CARDS: CardTargets = { product: new Map(), category: new Map() }

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

const isSitePath = (href: string) => href.startsWith("/")

function emphasised(text: string, marks: readonly Mark[] | undefined): string {
  let html = escapeHtml(text)
  if (marks?.some((mark) => mark.type === "italic")) {
    html = `<em>${html}</em>`
  }
  if (marks?.some((mark) => mark.type === "bold")) {
    html = `<strong>${html}</strong>`
  }
  return html
}

export const linkOf = (node: Inline): string | null =>
  node.type === "text"
    ? (node.marks?.find((mark) => mark.type === "link")?.attrs.href ?? null)
    : null

const anchor = (href: string, html: string) =>
  `<a href="${escapeHtml(href)}"${isSitePath(href) ? "" : ' rel="noopener noreferrer"'}>${html}</a>`

/** Text with its emphasis; neighbours linking to one address make one link (a partly bold link). */
function inlines(content: readonly Inline[] | undefined): string {
  let html = ""
  let run: { href: string; html: string } | null = null
  for (const node of content ?? []) {
    const href = linkOf(node)
    const inner = node.type === "text" ? emphasised(node.text, node.marks) : "<br>"
    if (run && run.href !== href) {
      html += anchor(run.href, run.html)
      run = null
    }
    if (href === null) {
      html += inner
    } else {
      run ??= { href, html: "" }
      run.html += inner
    }
  }
  return run ? html + anchor(run.href, run.html) : html
}

// An empty paragraph is the editor's spacing, not content
const paragraph = (node: Paragraph): string => {
  const html = inlines(node.content)
  return html ? `<p>${html}</p>` : ""
}

const listItem = (item: ListItem): string =>
  `<li>${item.content.map((child) => (child.type === "paragraph" ? paragraph(child) : block(child, NO_CARDS))).join("")}</li>`

// Numbers into attributes only as whole numbers: a document that skipped the check writes none
const whole = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null

function cell(node: TableCell): string {
  const tag = node.type === "tableHeader" ? "th" : "td"
  const span = (name: "colspan" | "rowspan") => {
    const value = whole(node.attrs?.[name])
    return value !== null && value > 1 ? ` ${name}="${String(value)}"` : ""
  }
  const spans = span("colspan") + span("rowspan")
  return `<${tag}${spans}>${node.content.map(paragraph).join("")}</${tag}>`
}

function card(kind: "product" | "category", id: string, cards: CardTargets): string {
  const target = cards[kind].get(id)
  if (!target) {
    return ""
  }
  return (
    `<aside class="qt-card qt-card--${kind}" data-${kind}-id="${escapeHtml(id)}">` +
    `<a href="${escapeHtml(target.path)}">${escapeHtml(target.title)}</a></aside>`
  )
}

function block(node: Block, cards: CardTargets): string {
  switch (node.type) {
    case "paragraph":
      return paragraph(node)
    case "heading": {
      const html = inlines(node.content)
      const level = [2, 3, 4].includes(node.attrs.level) ? node.attrs.level : 2
      return html ? `<h${String(level)}>${html}</h${String(level)}>` : ""
    }
    case "bulletList":
      return `<ul>${node.content.map(listItem).join("")}</ul>`
    case "orderedList": {
      const start = whole(node.attrs?.start)
      const attr = start !== null && start !== 1 ? ` start="${String(start)}"` : ""
      return `<ol${attr}>${node.content.map(listItem).join("")}</ol>`
    }
    case "blockquote":
      return `<blockquote>${node.content.map((child) => block(child, cards)).join("")}</blockquote>`
    case "table":
      return `<table><tbody>${node.content
        .map((row) => `<tr>${row.content.map(cell).join("")}</tr>`)
        .join("")}</tbody></table>`
    case "image": {
      const size = cards.images?.get(node.attrs.src)
      const measured = size ? ` width="${String(size.width)}" height="${String(size.height)}"` : ""
      return `<figure><img src="${escapeHtml(node.attrs.src)}" alt="${escapeHtml(node.attrs.alt ?? "")}"${measured} loading="lazy" decoding="async"></figure>`
    }
    case "productCard":
      return card("product", node.attrs.id, cards)
    case "categoryCard":
      return card("category", node.attrs.id, cards)
  }
}

/**
 * The document as HTML (adr/0019): only the allowlist's tags and
 * attributes, every text and address escaped. The input is a checked
 * document, never HTML, so there is nothing to sanitise.
 */
export function renderDoc(doc: ContentDoc, cards: CardTargets = NO_CARDS): string {
  return doc.content.map((node) => block(node, cards)).join("")
}
