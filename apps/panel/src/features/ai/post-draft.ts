import type { JSONContent } from "@tiptap/react"

/**
 * A blog post's draft (adr/0074 §5 madde 5), as the backend answers it:
 * headed sections of plain paragraphs, each text already gated there, and
 * internal link suggestions apart (a shown category or product of the
 * shop, by its storefront path). Read again here: anything of another
 * shape is never shown, and a path that is not one on the shop is dropped.
 */

export interface AiPostSection {
  /** Empty for the opening only: paragraphs before the first heading. */
  heading: string
  level: 2 | 3
  paragraphs: string[]
}

export interface AiPostLink {
  code: string
  kind: "category" | "product"
  name: string
  /** The page's storefront path (`/urun/…`). */
  path: string
  /** Why and where the link fits, as the service wrote it. */
  why: string
}

export interface AiPostDraft {
  sections: AiPostSection[]
  links: AiPostLink[]
  words: number
}

// A path on the shop, as the editor's link rule takes it (`features/content/editor/href.ts`)
const SITE_PATH = /^\/(?!\/)[^\s\\]{0,2047}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

function sectionOf(value: unknown, index: number): AiPostSection[] {
  if (!isRecord(value) || typeof value["heading"] !== "string") {
    return []
  }
  const paragraphs = Array.isArray(value["paragraphs"]) ? value["paragraphs"].filter(isText) : []
  const heading = value["heading"].trim()
  // Only the opening goes without a heading; a section with nothing to say is not drawn
  if (paragraphs.length === 0 || (heading === "" && index > 0)) {
    return []
  }
  return [{ heading, level: value["level"] === 3 ? 3 : 2, paragraphs }]
}

function linkOf(value: unknown): AiPostLink[] {
  if (
    !isRecord(value) ||
    !isText(value["code"]) ||
    (value["kind"] !== "category" && value["kind"] !== "product") ||
    !isText(value["name"]) ||
    typeof value["path"] !== "string" ||
    !SITE_PATH.test(value["path"]) ||
    typeof value["why"] !== "string"
  ) {
    return []
  }
  return [
    {
      code: value["code"],
      kind: value["kind"],
      name: value["name"],
      path: value["path"],
      why: value["why"],
    },
  ]
}

/** The draft of an answer, or null when it holds none of ours. */
export function readPostDraft(value: unknown): AiPostDraft | null {
  if (!isRecord(value) || !Array.isArray(value["sections"])) {
    return null
  }
  const sections = value["sections"].flatMap(sectionOf)
  if (sections.length === 0) {
    return null
  }
  const links = (Array.isArray(value["links"]) ? value["links"] : []).flatMap(linkOf)
  const words = typeof value["words"] === "number" ? value["words"] : 0
  return { sections, links, words }
}

const textNode = (text: string): JSONContent => ({ type: "text", text: text.trim() })

/**
 * The draft as the editor's document: a heading node (level 2 or 3) for each
 * section's heading, a paragraph for each paragraph, plain text only (no
 * marks, no links, nothing read as HTML).
 */
export function docOfPostDraft(draft: AiPostDraft): JSONContent {
  return {
    type: "doc",
    content: draft.sections.flatMap((section): JSONContent[] => [
      ...(section.heading === ""
        ? []
        : [
            {
              type: "heading",
              attrs: { level: section.level },
              content: [textNode(section.heading)],
            },
          ]),
      ...section.paragraphs.map((text) => ({ type: "paragraph", content: [textNode(text)] })),
    ]),
  }
}
