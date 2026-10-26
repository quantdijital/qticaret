import type { JSONContent } from "@tiptap/react"
import { isSafeHref } from "./href"

// The attributes the server keeps per node and mark (adr/0019, `lib/content/doc.ts`)
const KEPT: Readonly<Record<string, readonly string[]>> = {
  heading: ["level"],
  orderedList: ["start"],
  tableCell: ["colspan", "rowspan"],
  tableHeader: ["colspan", "rowspan"],
  image: ["src", "alt"],
  productCard: ["id"],
  categoryCard: ["id"],
  link: ["href"],
}

// Whole numbers within the server's bounds; anything else is left out (a pasted `start="-3"`)
const BOUNDS: Readonly<Record<string, readonly [number, number]>> = {
  start: [0, 100_000],
  colspan: [1, 50],
  rowspan: [1, 50],
}

function valueOf(name: string, value: unknown): unknown {
  const bounds = BOUNDS[name]
  if (!bounds) {
    return value
  }
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= bounds[0] &&
    value <= bounds[1]
    ? value
    : undefined
}

function attrsOf(type: string, attrs: Record<string, unknown> | undefined) {
  const kept = KEPT[type]
  if (!kept || !attrs) {
    return undefined
  }
  const picked = Object.fromEntries(
    kept.flatMap((name) => {
      const value = valueOf(name, attrs[name])
      return value === undefined ? [] : [[name, value]]
    })
  )
  return Object.keys(picked).length > 0 ? picked : undefined
}

// A link the server would refuse (a pasted `mailto:`) is dropped; its text stays
const keptMark = (mark: { type: string; attrs?: Record<string, unknown> }) =>
  mark.type !== "link" ||
  (typeof mark.attrs?.["href"] === "string" && isSafeHref(mark.attrs["href"]))

/**
 * The editor's document as the server stores it: attributes outside the
 * allowlist dropped (the editor adds `target`, `rel`, `width`…), so a saved
 * text and the editor's agree and an untouched page is not "changed".
 */
export function normalizeDoc(node: JSONContent): JSONContent {
  const type = node.type ?? ""
  const attrs = attrsOf(type, node.attrs)
  return {
    type,
    ...(attrs ? { attrs } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks?.some(keptMark)
      ? {
          marks: node.marks.filter(keptMark).map((mark) => {
            const markAttrs = attrsOf(mark.type, mark.attrs)
            return { type: mark.type, ...(markAttrs ? { attrs: markAttrs } : {}) }
          }),
        }
      : {}),
    ...(node.content ? { content: node.content.map(normalizeDoc) } : {}),
  }
}

// The editor adds an empty paragraph after a closing list, table or card, and keeps
// one in an empty text: neither is a change
function withoutTrailingEmpty(doc: JSONContent): JSONContent {
  const content = [...(doc.content ?? [])]
  while (content.at(-1)?.type === "paragraph" && !content.at(-1)?.content?.length) {
    content.pop()
  }
  return { ...doc, content }
}

/** Whether two documents say the same, as the server would store them. */
export const sameDoc = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(withoutTrailingEmpty(normalizeDoc(a))) ===
  JSON.stringify(withoutTrailingEmpty(normalizeDoc(b)))
