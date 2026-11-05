import type { ContentDoc } from "./doc"

/**
 * The links inside a content document (adr/0019): the `link` marks on its
 * text, wherever the text sits (paragraphs, headings, lists, quotes, table
 * cells). Read and rewritten without touching anything else in it, so a
 * rewritten document is the same document with other addresses
 * (adr/0042 Ek 2026-11-05, the migrated texts' old links).
 */

interface MarkJson {
  type?: unknown
  attrs?: { href?: unknown } | null
}

interface NodeJson {
  type?: unknown
  content?: unknown
  marks?: unknown
}

const isNode = (value: unknown): value is NodeJson =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const linkHref = (mark: unknown): string | null => {
  if (!isNode(mark)) {
    return null
  }
  const { type, attrs } = mark as MarkJson
  return type === "link" && typeof attrs?.href === "string" ? attrs.href : null
}

function visit(node: unknown, onHref: (href: string) => void): void {
  if (!isNode(node)) {
    return
  }
  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      const href = linkHref(mark)
      if (href !== null) {
        onHref(href)
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      visit(child, onHref)
    }
  }
}

/** Every link address in the document, each once, in reading order. */
export function docHrefs(doc: ContentDoc | null | undefined): string[] {
  const seen = new Set<string>()
  visit(doc, (href) => seen.add(href))
  return [...seen]
}

function rewrite(node: unknown, next: ReadonlyMap<string, string>, count: { n: number }): unknown {
  if (!isNode(node)) {
    return node
  }
  let copy: NodeJson | null = null
  if (Array.isArray(node.marks)) {
    const marks = (node.marks as unknown[]).map((mark): unknown => {
      const href = linkHref(mark)
      const to = href === null ? undefined : next.get(href)
      if (to === undefined || to === href) {
        return mark
      }
      count.n += 1
      const { attrs } = mark as MarkJson
      return { ...(mark as object), attrs: { ...(attrs ?? {}), href: to } }
    })
    if (marks.some((mark, index) => mark !== (node.marks as unknown[])[index])) {
      copy = { ...node, marks }
    }
  }
  if (Array.isArray(node.content)) {
    const content = node.content.map((child) => rewrite(child, next, count))
    if (content.some((child, index) => child !== (node.content as unknown[])[index])) {
      copy = { ...(copy ?? node), content }
    }
  }
  return copy ?? node
}

/**
 * The document with each link whose address `next` names pointed at its
 * new address, and how many links changed. Nodes without a change are
 * kept as they were; a document with none comes back itself.
 */
export function rewriteDocHrefs(
  doc: ContentDoc,
  next: ReadonlyMap<string, string>
): { doc: ContentDoc; changed: number } {
  const count = { n: 0 }
  const written = rewrite(doc, next, count) as ContentDoc
  return { doc: written, changed: count.n }
}
