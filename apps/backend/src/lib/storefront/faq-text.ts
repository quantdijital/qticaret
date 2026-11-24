import { renderDoc } from "../content"
import type { Block, ContentDoc } from "../content"
import { isFaqHeading } from "./sections/faq"
import type { FaqRow } from "./sections/faq"

/**
 * An FAQ and a text of questions, both ways (adr/0073 Ek 2026-11-24 (2)).
 *
 * `faqRowsOf` reads a page text as the storefront read it while a page
 * text's `questions` was `auto` (`apps/storefront/src/lib/views/faq.ts`
 * `faqOf`, the same rules on the same HTML): each question a line set
 * wholly in bold, or a heading, ending in "?"; its answer what follows up
 * to the next question or heading; the other headings name the groups;
 * fewer than three questions is an ordinary text. Used once, to turn the
 * pages drawn that way into FAQ sections (`faq-convert.ts`); a text that
 * would not come out the same (words before the first question or under
 * a heading before its first question, a question with no answer, an
 * answer with a picture, a table, a quote or a card) is not one.
 *
 * `faqDoc` writes an FAQ back as a document, for the page's `body`
 * mirror (K2): each group's heading an h2, each question a bold line, its
 * answer after it.
 */

/** A top-level block, its HTML split as the storefront splits it: tag and inner HTML. */
interface Read {
  block: Block
  tag: string
  inner: string
}

const ELEMENT = /^<([a-z][a-z0-9]*)(?:\s[^>]*)?>([\s\S]*)<\/\1>$/
const HEADING = /^h[2-4]$/
const BOLD_LINE = /^\s*<strong>([\s\S]*?)<\/strong>\s*$/
const MIN_QUESTIONS = 3

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** An element's words as a reader sees them: tags dropped, entities read (the storefront's `wordsOf`). */
export function wordsOf(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
      }
      if (name.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
      }
      return ENTITIES[name.toLowerCase()] ?? whole
    })
    .replace(/\s+/g, " ")
    .trim()
}

/** The document's blocks that print (an empty paragraph prints nothing), each read as its element. */
function readBlocks(doc: ContentDoc): Read[] {
  return doc.content.flatMap((block) => {
    const element = ELEMENT.exec(renderDoc({ type: "doc", content: [block] }))
    return element?.[1] !== undefined && element[2] !== undefined
      ? [{ block, tag: element[1], inner: element[2] }]
      : []
  })
}

const asks = (words: string): boolean => /\?\s*$/.test(words)

function boldQuestion(read: Read): string | null {
  if (read.tag !== "p") {
    return null
  }
  const bold = BOLD_LINE.exec(read.inner)
  const words = bold?.[1] && !bold[1].includes("<strong") ? wordsOf(bold[1]) : ""
  return words && asks(words) ? words : null
}

function headingQuestion(read: Read): string | null {
  if (!HEADING.test(read.tag)) {
    return null
  }
  const words = wordsOf(read.inner)
  return words && asks(words) ? words : null
}

/** How the text's questions are told (bold lines, else asking headings); null: fewer than three. */
function questionsOf(reads: readonly Read[]): ((read: Read) => string | null) | null {
  const bold = reads.filter((read) => boldQuestion(read) !== null).length
  const questionOf = bold >= MIN_QUESTIONS ? boldQuestion : headingQuestion
  return reads.filter((read) => questionOf(read) !== null).length < MIN_QUESTIONS
    ? null
    : questionOf
}

/** Whether the storefront drew the text as questions (with `questions: auto`). */
export const readsAsQuestions = (doc: ContentDoc): boolean => questionsOf(readBlocks(doc)) !== null

/** An answer's blocks: the ones an FAQ answer takes (paragraphs and lists). */
const ANSWER_BLOCKS: ReadonlySet<string> = new Set(["paragraph", "bulletList", "orderedList"])

/**
 * The text's rows when the storefront drew it as questions and an FAQ
 * draws it the same; null otherwise. Bold questions win where there are
 * enough of them (then every heading is a group's, even one ending in
 * "?"); else asking headings are the questions and the rest name groups.
 */
export function faqRowsOf(doc: ContentDoc): FaqRow[] | null {
  const reads = readBlocks(doc)
  const questionOf = questionsOf(reads)
  if (!questionOf) {
    return null
  }
  const rows: FaqRow[] = []
  let answer: Block[] | null = null
  const close = (): boolean => {
    const last = rows.at(-1)
    if (answer !== null && last && !isFaqHeading(last)) {
      if (answer.length === 0) {
        return false
      }
      last.body = { type: "doc", content: answer }
    }
    answer = null
    return true
  }
  for (const read of reads) {
    const question = questionOf(read)
    if (question !== null) {
      if (!close()) {
        return null
      }
      rows.push({ question })
      answer = []
      continue
    }
    if (HEADING.test(read.tag)) {
      const heading = wordsOf(read.inner)
      if (!close() || heading === "") {
        return null
      }
      rows.push({ heading })
      continue
    }
    // Words before the first question or under a heading before its first: no FAQ row holds them
    if (answer === null || !ANSWER_BLOCKS.has(read.block.type)) {
      return null
    }
    answer.push(read.block)
  }
  return close() ? rows : null
}

const boldLine = (text: string): Block => ({
  type: "paragraph",
  content: [{ type: "text", text, marks: [{ type: "bold" }] }],
})

/** The FAQ as a document: each heading an h2, each question a bold line, then its answer. */
export function faqDoc(rows: readonly FaqRow[]): ContentDoc {
  const content: Block[] = rows.flatMap((row): Block[] => {
    if (isFaqHeading(row)) {
      return [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: row.heading }] },
      ]
    }
    const answer: Block[] = row.body
      ? row.body.content
      : [{ type: "paragraph", content: [{ type: "text", text: row.answer ?? "" }] }]
    return [boldLine(row.question), ...answer]
  })
  return { type: "doc", content }
}
