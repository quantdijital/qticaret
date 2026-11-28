import type { Block, ContentDoc } from "../content"
import { isSafeHref } from "../content"
import { uploadKey } from "./sources/wordpress/body-images"
import { plainOf } from "./sources/wordpress/html"

/**
 * A moved body's pictures (adr/0042 Ek 2026-11-27), as plain document
 * work: the old files an imported body names, the body with each swapped
 * for its stored copy (one that could not be stored left out, a link to
 * any size of a stored one pointed at the copy), and, for a post moved
 * before, the new pictures put into the body as it is now, each after the
 * text it followed there.
 */

/** The old files a body's image blocks name, once each, in order. */
export function imageSources(doc: ContentDoc): string[] {
  return [
    ...new Set(doc.content.flatMap((block) => (block.type === "image" ? [block.attrs.src] : []))),
  ]
}

const uploadOf = (href: string): string | null => {
  const path = href.startsWith("/") ? href : URL.canParse(href) ? new URL(href).pathname : ""
  return path.includes("/wp-content/uploads/") ? uploadKey(path.split(/[?#]/)[0] ?? "") : null
}

// Every link mark in a node's tree pointed at its stored copy
function swapLinks(node: unknown, copies: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(node)) {
    return node.map((child) => swapLinks(child, copies))
  }
  if (node === null || typeof node !== "object") {
    return node
  }
  const own = node as { type?: unknown; attrs?: { href?: unknown } }
  if (own.type === "link" && own.attrs && typeof own.attrs === "object") {
    const href = own.attrs.href
    const upload = typeof href === "string" ? uploadOf(href) : null
    const copy = upload ? copies.get(upload) : undefined
    return copy && isSafeHref(copy) ? { ...own, attrs: { ...own.attrs, href: copy } } : own
  }
  return Object.fromEntries(
    Object.entries(own).map(([key, value]) => [key, swapLinks(value, copies)])
  )
}

/**
 * The body with its pictures swapped for their stored copies (`stored`:
 * old file → new address); a picture not stored left out; text links to
 * a stored file (any of its sizes) pointed at the copy.
 */
export function swapImages(doc: ContentDoc, stored: ReadonlyMap<string, string>): ContentDoc {
  const copies = new Map<string, string>()
  for (const [old, copy] of stored) {
    const upload = uploadOf(old)
    if (upload) {
      copies.set(upload, copy)
    }
  }
  const content = doc.content.flatMap((block): Block[] => {
    if (block.type !== "image") {
      return [block]
    }
    const copy = stored.get(block.attrs.src)
    return copy ? [{ ...block, attrs: { ...block.attrs, src: copy } }] : []
  })
  return swapLinks({ ...doc, content }, copies) as ContentDoc
}

const textOf = (block: Block) => plainOf(block).join(" ").replace(/\s+/g, " ").trim()

/**
 * A post moved before, its pictures added (`added`: old file → new
 * address): the body as it is now, each picture put after the text block
 * it followed in the export (matched by its words; edited text is passed
 * over, the picture then follows the last block that matched). Pictures
 * not named in `added` are not touched, nor one whose copy the body
 * already shows (a save that went through before its record did).
 */
export function insertImages(
  current: ContentDoc,
  source: ContentDoc,
  added: ReadonlyMap<string, string>
): ContentDoc {
  const out: Block[] = [...current.content]
  const shown = new Set(
    current.content.flatMap((block) => (block.type === "image" ? [block.attrs.src] : []))
  )
  let at = 0
  for (const block of source.content) {
    if (block.type === "image") {
      const copy = added.get(block.attrs.src)
      if (copy && !shown.has(copy)) {
        shown.add(copy)
        out.splice(at, 0, { ...block, attrs: { ...block.attrs, src: copy } })
        at += 1
      }
      continue
    }
    const words = textOf(block)
    if (words === "") {
      continue
    }
    const found = out.findIndex(
      (candidate, index) => index >= at && candidate.type !== "image" && textOf(candidate) === words
    )
    if (found !== -1) {
      at = found + 1
    }
  }
  return { ...current, content: out }
}
