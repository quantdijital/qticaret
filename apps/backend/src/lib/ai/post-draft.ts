import { z } from "@medusajs/framework/zod"
import { countWords } from "../content/stats"
import { suggestionProblems, suggestionText } from "./gate"
import { jsonObjectOf } from "./product-card"
import {
  POST_DRAFT_TASK,
  POST_GATE_WORDS,
  POST_HEADING_MAX_LENGTH,
  POST_LINK_WHY_MAX_LENGTH,
  POST_MAX_LINKS,
  POST_PARAGRAPH_MAX_LENGTH,
  POST_SECTIONS,
  POST_SECTION_PARAGRAPHS,
} from "./registry/content-tasks"
import type { AiTask } from "./registry/tasks"

/**
 * A blog post's draft (adr/0074 §5 madde 5). The answer is data, never
 * trusted: one JSON object `{"sections": [{"heading", "level"?,
 * "paragraphs"}], "links": [{"code", "why"}]}`, `.strict()` at every
 * level (another key refuses it). Every heading and paragraph goes through
 * the shared gate on its own (markup in the raw text, a link, personal
 * data, shouting, a masked name) and may write no price; any one failing
 * refuses the draft (a hole in an article is worse than asking again).
 * Only the first section may go without a heading: the opening answer
 * before the first heading (docs/14 A-ANSWER-01). The whole stays in the
 * gate's word range. A link names a code of the list the prompt sent,
 * held on the server (`allowed`); an unknown or repeated code, or a reason
 * that fails the gate, drops that link alone (`dropped_links`): the links
 * are a suggestion beside the draft, never in it.
 */

/** The data block's list of link candidates: what the instruction names. */
export const LINK_CHOICES_FIELD = "link_choices"

export type PostLinkKind = "category" | "product"

/** A link candidate as the server holds it; only its code and name are sent. */
export interface PostLinkChoice {
  code: string
  kind: PostLinkKind
  id: string
  name: string
  /** Its storefront path (the URL registry's active one). */
  path: string
}

/** What a draft's links are held against: the candidates read on the server. */
export interface PostDraftAllowed {
  kind: "post_draft"
  choices: PostLinkChoice[]
}

export interface PostDraftSection {
  /** Empty for the opening only: paragraphs before the first heading. */
  heading: string
  level: 2 | 3
  paragraphs: string[]
}

export interface PostDraftLink extends PostLinkChoice {
  why: string
}

/** What the panel offers: the sections in order, the links apart. */
export interface PostDraft {
  sections: PostDraftSection[]
  links: PostDraftLink[]
  words: number
  dropped_links: number
}

export type PostDraftResult = { draft: PostDraft } | { problems: string[] }

/** Whether a task's lists are a post draft's. */
export const isPostDraftAllowed = (allowed: unknown): allowed is PostDraftAllowed =>
  typeof allowed === "object" &&
  allowed !== null &&
  (allowed as { kind?: unknown }).kind === "post_draft"

const answerSchema = z
  .object({
    sections: z.array(z.unknown()).max(POST_SECTIONS.max * 2),
    links: z
      .array(z.unknown())
      .max(POST_MAX_LINKS * 2)
      .optional(),
  })
  .strict()

const sectionSchema = z
  .object({
    heading: z.string().max(POST_HEADING_MAX_LENGTH * 4),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
    paragraphs: z
      .array(z.string().max(POST_PARAGRAPH_MAX_LENGTH * 4))
      .min(1)
      .max(POST_SECTION_PARAGRAPHS * 2),
  })
  .strict()

const linkSchema = z.object({ code: z.string().max(16), why: z.string().max(400) }).strict()

// Each text as its own plain text: the shared gate, the text's own length
const textTask = (maxLength: number): AiTask => ({
  ...POST_DRAFT_TASK,
  gate: "plain_text",
  maxLength,
})
const HEADING_TASK = textTask(POST_HEADING_MAX_LENGTH)
const PARAGRAPH_TASK = textTask(POST_PARAGRAPH_MAX_LENGTH)
const WHY_TASK = textTask(POST_LINK_WHY_MAX_LENGTH)

// A price in Turkish lira: never in the data, and stale the day it changes
const PRICE = /₺|\d\s*(?:TL|TRY)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(?:TL|TRY)\s*\d/u

// Markup in what was written, before it is cleaned: a tag is refused, never silently dropped
const MARKUP = /<\/?[a-z!?]/i

/** A text as stored: plain (`suggestionText`), then one line. */
const oneLine = (raw: string): string => suggestionText(raw).replace(/\s+/gu, " ").trim()

/** What is wrong with one text of the draft; none passes. */
function textProblems(task: AiTask, raw: string, text: string): string[] {
  const problems = suggestionProblems(task, text)
  if (MARKUP.test(raw) && !problems.includes("markup")) {
    problems.push("markup")
  }
  if (problems.length === 0 && PRICE.test(text)) {
    problems.push("price")
  }
  return problems
}

type SectionRead = { section: PostDraftSection } | { problems: string[] }

function sectionOf(raw: unknown, index: number, afterHeading: boolean): SectionRead {
  const shaped = sectionSchema.safeParse(raw)
  if (!shaped.success) {
    return { problems: [`sections.${String(index)}.format`] }
  }
  const at = `sections.${String(index)}`
  const heading = oneLine(shaped.data.heading)
  const problems: string[] = []
  if (heading === "") {
    // The opening alone goes without a heading; any later section needs one
    if (index > 0) {
      problems.push(`${at}.heading.empty`)
    }
  } else {
    problems.push(
      ...textProblems(HEADING_TASK, shaped.data.heading, heading).map(
        (each) => `${at}.heading.${each}`
      )
    )
  }
  const paragraphs = shaped.data.paragraphs.map(oneLine)
  shaped.data.paragraphs.forEach((rawText, n) => {
    const text = paragraphs[n] ?? ""
    problems.push(
      ...textProblems(PARAGRAPH_TASK, rawText, text).map(
        (each) => `${at}.paragraphs.${String(n)}.${each}`
      )
    )
  })
  if (problems.length > 0) {
    return { problems }
  }
  // A sub-heading only under a heading: one before any is a heading of its own
  const level = shaped.data.level === 3 && afterHeading ? 3 : 2
  return { section: { heading, level, paragraphs } }
}

/** The links that name a listed code once, each with a reason through the gate. */
function linksOf(
  raw: readonly unknown[],
  allowed: PostDraftAllowed
): { links: PostDraftLink[]; dropped: number } {
  const byCode = new Map(allowed.choices.map((choice) => [choice.code.toLowerCase(), choice]))
  const seen = new Set<string>()
  const links: PostDraftLink[] = []
  let dropped = 0
  for (const each of raw) {
    const shaped = linkSchema.safeParse(each)
    const code = shaped.success ? shaped.data.code.trim().toLowerCase() : ""
    const choice = byCode.get(code)
    const why = shaped.success ? oneLine(shaped.data.why) : ""
    if (
      !shaped.success ||
      !choice ||
      seen.has(choice.code) ||
      links.length >= POST_MAX_LINKS ||
      textProblems(WHY_TASK, shaped.data.why, why).length > 0
    ) {
      dropped++
      continue
    }
    seen.add(choice.code)
    links.push({ ...choice, why })
  }
  return { links, dropped }
}

const wordsOf = (sections: readonly PostDraftSection[]): number =>
  sections.reduce(
    (sum, each) =>
      sum +
      countWords(each.heading) +
      each.paragraphs.reduce((inner, text) => inner + countWords(text), 0),
    0
  )

// Problems named in a refusal at most: the first are enough to see why
const MAX_PROBLEMS = 12

/** A service's answer as a draft, or why it was refused. */
export function postDraftOf(raw: string, allowed: PostDraftAllowed): PostDraftResult {
  const parsed = answerSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const { sections: rawSections, links: rawLinks = [] } = parsed.data
  if (rawSections.length === 0) {
    return { problems: ["empty"] }
  }
  if (rawSections.length < POST_SECTIONS.min || rawSections.length > POST_SECTIONS.max) {
    return { problems: ["sections"] }
  }
  const sections: PostDraftSection[] = []
  const problems: string[] = []
  rawSections.forEach((each, index) => {
    const read = sectionOf(
      each,
      index,
      sections.some((done) => done.heading !== "")
    )
    if ("problems" in read) {
      problems.push(...read.problems)
    } else {
      sections.push(read.section)
    }
  })
  if (problems.length > 0) {
    return { problems: problems.slice(0, MAX_PROBLEMS) }
  }
  const words = wordsOf(sections)
  if (words < POST_GATE_WORDS.min) {
    return { problems: ["too_short"] }
  }
  if (words > POST_GATE_WORDS.max) {
    return { problems: ["too_long"] }
  }
  const { links, dropped } = linksOf(rawLinks, allowed)
  return { draft: { sections, links, words, dropped_links: dropped } }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === "string"

/** A stored draft back from its suggestion's text; null for any other text. */
export function readPostDraft(text: string | null): PostDraft | null {
  if (text === null) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    if (!isRecord(value) || !Array.isArray(value["sections"])) {
      return null
    }
    const sections = value["sections"].flatMap((each: unknown): PostDraftSection[] =>
      isRecord(each) && isString(each["heading"]) && Array.isArray(each["paragraphs"])
        ? [
            {
              heading: each["heading"],
              level: each["level"] === 3 ? 3 : 2,
              paragraphs: each["paragraphs"].filter(isString),
            },
          ]
        : []
    )
    const links = (Array.isArray(value["links"]) ? value["links"] : []).flatMap(
      (each: unknown): PostDraftLink[] =>
        isRecord(each) &&
        isString(each["code"]) &&
        (each["kind"] === "category" || each["kind"] === "product") &&
        isString(each["id"]) &&
        isString(each["name"]) &&
        isString(each["path"]) &&
        isString(each["why"])
          ? [
              {
                code: each["code"],
                kind: each["kind"],
                id: each["id"],
                name: each["name"],
                path: each["path"],
                why: each["why"],
              },
            ]
          : []
    )
    const words = value["words"]
    const dropped = value["dropped_links"]
    return {
      sections,
      links,
      words: typeof words === "number" ? words : 0,
      dropped_links: typeof dropped === "number" ? dropped : 0,
    }
  } catch {
    return null
  }
}
