import { z } from "@medusajs/framework/zod"
import { cleanText } from "../../../lib/ai/prompt"
import { aiTasks, writesProse } from "../../../lib/ai/registry/tasks"
import { guidanceSaveIssue, mergeGuidance } from "./ai-guidance-craft"
import { defineSection, isPlainObject } from "./define"

/**
 * The shop's writing guidance for AI text (adr/0074 §2): its tone, how it
 * addresses the reader, who it writes for, a free note, words it prefers
 * and avoids, and per text task an extra note and up to three examples it
 * liked. It goes into the system message as a labelled part
 * (lib/ai/guidance.ts), never into the data block; the fixed rules come
 * after it and the gate runs as before. Owner and admin write it, as any
 * section; every change is in the audit log (adr/0011). No migration: a
 * row of the settings store, like `ai_scenes`.
 */

export const AI_TONES = ["warm", "professional", "expert", "premium", "plain"] as const
export type AiTone = (typeof AI_TONES)[number]

export const AI_ADDRESSES = ["sen", "siz", "none"] as const
export type AiAddress = (typeof AI_ADDRESSES)[number]

/** The limits, in characters (code points) or items; the panel's counters show the same. */
export const GUIDANCE_LIMITS = {
  audience: 160,
  guide: 1_500,
  words: 20,
  word: 40,
  extra: 600,
  examples: 3,
  example: 600,
  craft: 3_000,
} as const

export interface AiTaskGuidance {
  /** An extra note for this task alone; null: none. */
  extra: string | null
  /** Texts the shop liked, given as a model of tone and shape, never to copy. */
  examples: string[]
  /**
   * The owner's own craft, in the default's place (adr/0074 §3); null or
   * left out: the default. The owner's alone to write (the route checks).
   */
  craft?: string | null
  /** The default craft's version when the craft was written (`craftVersion`); the server sets it. */
  craft_base?: string | null
}

export interface AiGuidanceSettings {
  tone: AiTone
  address: AiAddress
  audience: string | null
  guide: string | null
  prefer: string[]
  avoid: string[]
  /** By a text task's id (the registry's); a task without guidance has no entry. */
  tasks: Partial<Record<string, AiTaskGuidance>>
}

export const AI_GUIDANCE_DEFAULTS: AiGuidanceSettings = {
  tone: "warm",
  address: "siz",
  audience: null,
  guide: null,
  prefer: [],
  avoid: [],
  tasks: {},
}

const TOO_LONG = "ai.guidance_too_long"
const WORDS_FULL = "ai.guidance_words_full"
const EXAMPLES_FULL = "ai.guidance_examples_full"
const UNKNOWN_TASK = "ai.guidance_unknown_task"

/**
 * Whether the guidance may be given for this task: a text task of the
 * registry that writes prose; one answered as JSON (a product's tags or
 * categories) takes none, unless its texts are prose (a product's FAQ;
 * `writesProse`, as `takesGuidance`).
 */
export const isGuidanceTask = (id: string): boolean =>
  aiTasks().some((task) => task.id === id && writesProse(task))

// Markup goes whole; a stray angle bracket with it
const TAG = /<[^>]*>|[<>]/g
// Characters that draw nothing: zero-width and bidi controls, joiners, tags, fillers
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/gu
// Control characters but the line break; a tab is read as a space before this
const CONTROL = /[^\P{Cc}\n]/gu
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

const length = (text: string) => Array.from(text).length

/**
 * A value as it is kept: markup, invisible and control characters taken
 * out, spaces folded (a line break kept where `multiline`, at most one
 * empty line in a row). Idempotent, so a stored value passes it unchanged.
 */
export function plainGuidanceText(raw: string, multiline: boolean): string {
  const text = raw
    .normalize("NFC")
    .replace(LONE_SURROGATE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(TAG, " ")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
  if (!multiline) {
    return text.replace(/\s+/gu, " ").trim()
  }
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * The value as it may reach a service, or null when nothing is left:
 * plain (above), then personal data taken out by the shared filter
 * (`cleanText`). Too long is the caller's issue, decided on the plain text.
 */
function keptText(raw: string, max: number, multiline: boolean): string | null {
  const plain = plainGuidanceText(raw, multiline)
  if (plain === "") {
    return null
  }
  // A redaction never lengthens a text past the limit in practice; held to it anyway
  const kept = Array.from(cleanText(plain, max)).slice(0, max).join("").trim()
  return kept === "" ? null : kept
}

// The raw text's own bound keeps the filter's work small; the limit is ours, said by our key
const rawText = (max: number) => z.string().max(max * 4)

function text(max: number, multiline: boolean) {
  return rawText(max)
    .nullable()
    .transform((value, ctx): string | null => {
      if (value === null) {
        return null
      }
      if (length(plainGuidanceText(value, multiline)) > max) {
        ctx.addIssue({ code: "custom", message: TOO_LONG, input: value })
        return z.NEVER
      }
      return keptText(value, max, multiline)
    })
}

/** A list of words: each one line, empty ones dropped, the same word kept once. */
const words = z
  .array(rawText(GUIDANCE_LIMITS.word))
  .max(GUIDANCE_LIMITS.words * 4)
  .transform((list, ctx): string[] => {
    const kept: string[] = []
    for (const raw of list) {
      if (length(plainGuidanceText(raw, false)) > GUIDANCE_LIMITS.word) {
        ctx.addIssue({ code: "custom", message: TOO_LONG, input: raw })
        return z.NEVER
      }
      const word = keptText(raw, GUIDANCE_LIMITS.word, false)
      const seen = kept.some(
        (each) => each.toLocaleLowerCase("tr") === word?.toLocaleLowerCase("tr")
      )
      if (word !== null && !seen) {
        kept.push(word)
      }
    }
    return kept
  })
  .refine((list) => list.length <= GUIDANCE_LIMITS.words, { message: WORDS_FULL })

const examples = z
  .array(rawText(GUIDANCE_LIMITS.example))
  .max(GUIDANCE_LIMITS.examples * 4)
  .refine((list) => list.length <= GUIDANCE_LIMITS.examples, { message: EXAMPLES_FULL })
  .transform((list, ctx): string[] => {
    const kept: string[] = []
    for (const raw of list) {
      if (length(plainGuidanceText(raw, true)) > GUIDANCE_LIMITS.example) {
        ctx.addIssue({ code: "custom", message: TOO_LONG, input: raw })
        return z.NEVER
      }
      const example = keptText(raw, GUIDANCE_LIMITS.example, true)
      if (example !== null) {
        kept.push(example)
      }
    }
    return kept
  })

// A version label as `craftVersion` writes it
const CRAFT_VERSION = /^[0-9a-f]{12}$/

const taskGuidance = z
  .object({
    extra: text(GUIDANCE_LIMITS.extra, true).optional(),
    examples: examples.optional(),
    craft: text(GUIDANCE_LIMITS.craft, true).optional(),
    craft_base: z.string().regex(CRAFT_VERSION).nullable().optional(),
  })
  .strict()
  .transform((value): AiTaskGuidance => ({
    extra: value.extra ?? null,
    examples: value.examples ?? [],
    // Left out stays left out: a save that does not send the craft keeps the stored one
    ...(value.craft === undefined ? {} : { craft: value.craft }),
    ...(value.craft_base === undefined ? {} : { craft_base: value.craft_base }),
  }))

/**
 * The tasks' guidance: only the registry's text tasks. A task cleared is
 * kept as an empty entry (no note, no example), not left out: the store
 * merges a section's JSON into the row, so a key left out would keep its
 * old value. An empty entry says nothing (lib/ai/guidance.ts).
 */
// Unknown keys turned away before their values are cleaned
const tasks = z
  .record(z.string().max(64), z.unknown())
  .superRefine((record, ctx) => {
    for (const id of Object.keys(record)) {
      if (!isGuidanceTask(id)) {
        ctx.addIssue({ code: "custom", message: UNKNOWN_TASK, path: [id], input: id })
      }
    }
  })
  .pipe(z.record(z.string(), taskGuidance))

/**
 * A stored row's tasks a deploy no longer knows are left out on read, so
 * the others keep reading instead of the whole record falling back.
 */
function upgrade(stored: Record<string, unknown>): Record<string, unknown> {
  const listed = stored["tasks"]
  if (!isPlainObject(listed)) {
    return stored
  }
  const known = Object.entries(listed).filter(([id]) => isGuidanceTask(id))
  return known.length === Object.keys(listed).length
    ? stored
    : { ...stored, tasks: Object.fromEntries(known) }
}

export const aiGuidanceSection = defineSection<AiGuidanceSettings>(
  "ai_guidance",
  {
    tone: z.enum(AI_TONES),
    address: z.enum(AI_ADDRESSES),
    audience: text(GUIDANCE_LIMITS.audience, false),
    guide: text(GUIDANCE_LIMITS.guide, true),
    prefer: words,
    avoid: words,
    tasks,
  },
  AI_GUIDANCE_DEFAULTS,
  undefined,
  upgrade,
  guidanceSaveIssue,
  mergeGuidance
)
