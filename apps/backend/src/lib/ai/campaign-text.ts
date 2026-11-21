import { z } from "@medusajs/framework/zod"
import { composeSms, smsLength } from "../campaigns/sms"
import { countWords } from "../content/stats"
import { suggestionProblems, suggestionText } from "./gate"
import { jsonObjectOf } from "./product-card"
import {
  CAMPAIGN_BODY_WORDS,
  CAMPAIGN_EMAIL_TASK,
  CAMPAIGN_PARAGRAPHS,
  CAMPAIGN_PARAGRAPH_MAX_LENGTH,
  CAMPAIGN_PREHEADER_MAX_LENGTH,
  CAMPAIGN_SMS_COUNT,
  CAMPAIGN_SMS_MAX_LENGTH,
  CAMPAIGN_SMS_TASK,
  CAMPAIGN_SUBJECT_COUNT,
  CAMPAIGN_SUBJECT_MAX_LENGTH,
} from "./registry/campaign-tasks"
import type { AiTask } from "./registry/tasks"

/**
 * A bulk message's words as the service answers them (adr/0074 §5 madde
 * 6). The answer is data, never trusted: one JSON object, `.strict()` at
 * the top. Every text is plain, one line (a paragraph is one), through the
 * shared gate (markup, a link, a person's data, shouting, a masked name)
 * and written with no figure the data block does not hold (`figure`): a
 * discount, a price or a date is the shop's to state, never the model's.
 * No `{token}` either: a recipient's name or a shop detail is the shop's
 * to place.
 *
 * - An e-mail `{"subjects": […], "preheader": "…", "paragraphs": […]}`:
 *   a subject that fails drops, one at least must pass; a preview line
 *   that fails is left out; the body is whole or refused (a hole in a
 *   message is worse than asking again), its words within
 *   `CAMPAIGN_BODY_WORDS`.
 * - A text `{"texts": […]}`: each must fit one SMS with the shop's name
 *   and the opt-out line after it, counted as the send counts it
 *   (lib/campaigns/sms.ts); one that does not drops.
 */

/** What a campaign's answer is held against, read on the server (task-input). */
export interface CampaignAllowed {
  kind: "campaign"
  /** The figures the data block holds (its rate, a code's digits): the only ones a text may write. */
  numbers: string[]
  /** An SMS's end the backend adds to every text; null for an e-mail. */
  sms: { shop: string; opt_out: string } | null
}

export interface CampaignEmail {
  subjects: string[]
  preheader: string | null
  paragraphs: string[]
}

export type CampaignEmailResult = { email: CampaignEmail } | { problems: string[] }
export type CampaignSmsResult = { texts: string[] } | { problems: string[] }

/** Whether a call's lists are a campaign's. */
export const isCampaignAllowed = (allowed: unknown): allowed is CampaignAllowed =>
  typeof allowed === "object" &&
  allowed !== null &&
  (allowed as { kind?: unknown }).kind === "campaign"

// A figure as written: digits, with a decimal or thousands mark inside ("%20", "1.250", "2,5")
const FIGURE = /\p{N}+(?:[.,]\p{N}+)*/gu

/** The figures in some texts, as written. */
export const figuresOf = (texts: readonly (string | null | undefined)[]): string[] => [
  ...new Set(texts.flatMap((text) => text?.match(FIGURE) ?? [])),
]

// Markup in what was written, before it is cleaned: a tag is refused, never silently dropped
const MARKUP = /<\/?[a-z!?]/i
// A `{token}` or what is left of one
const TOKEN = /[{}]/

/** A text as stored: plain (`suggestionText`), then one line. */
const oneLine = (raw: string): string => suggestionText(raw).replace(/\s+/gu, " ").trim()

const asTask = (task: AiTask, maxLength: number): AiTask => ({
  ...task,
  gate: "plain_text",
  maxLength,
})
const SUBJECT_TASK = asTask(CAMPAIGN_EMAIL_TASK, CAMPAIGN_SUBJECT_MAX_LENGTH)
const PREHEADER_TASK = asTask(CAMPAIGN_EMAIL_TASK, CAMPAIGN_PREHEADER_MAX_LENGTH)
const PARAGRAPH_TASK = asTask(CAMPAIGN_EMAIL_TASK, CAMPAIGN_PARAGRAPH_MAX_LENGTH)
const SMS_TASK = asTask(CAMPAIGN_SMS_TASK, CAMPAIGN_SMS_MAX_LENGTH)

/** What is wrong with one text of the answer; an empty list passes. */
export function campaignTextProblems(
  task: AiTask,
  raw: string,
  text: string,
  allowed: CampaignAllowed
): string[] {
  const problems = suggestionProblems(task, text)
  if (MARKUP.test(raw) && !problems.includes("markup")) {
    problems.push("markup")
  }
  if (TOKEN.test(text)) {
    problems.push("token")
  }
  const known = new Set(allowed.numbers)
  if (problems.length === 0 && figuresOf([text]).some((figure) => !known.has(figure))) {
    problems.push("figure")
  }
  return problems
}

/** A text folded to find repeats: lower case, marks and spaces out. */
const fold = (text: string): string =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

/** Each string that passes, repeats dropped, up to `count`; the first problems seen when none. */
function passing(
  values: readonly unknown[],
  task: AiTask,
  allowed: CampaignAllowed,
  count: number,
  extra: (text: string) => string[] = () => []
): { texts: string[]; problems: string[] } {
  const texts: string[] = []
  const problems = new Set<string>()
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== "string") {
      problems.add("format")
      continue
    }
    const text = oneLine(value)
    const found = [...campaignTextProblems(task, value, text, allowed), ...extra(text)]
    if (found.length > 0) {
      found.forEach((each) => problems.add(each))
      continue
    }
    if (!seen.has(fold(text)) && texts.length < count) {
      seen.add(fold(text))
      texts.push(text)
    }
  }
  return { texts, problems: [...problems] }
}

// More texts than an answer should hold are not read at all
const emailSchema = z
  .object({
    subjects: z.array(z.unknown()).max(CAMPAIGN_SUBJECT_COUNT * 2),
    preheader: z.unknown().optional(),
    paragraphs: z.array(z.unknown()).max(CAMPAIGN_PARAGRAPHS.max * 2),
  })
  .strict()

const subject = (problem: string): string => `subject.${problem}`

/** An e-mail's answer as subjects, a preview line and paragraphs, or why it was refused. */
export function campaignEmailOf(raw: string, allowed: CampaignAllowed): CampaignEmailResult {
  const parsed = emailSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const { subjects, preheader, paragraphs } = parsed.data
  const taken = passing(subjects, SUBJECT_TASK, allowed, CAMPAIGN_SUBJECT_COUNT)
  if (taken.texts.length === 0) {
    return { problems: (taken.problems.length > 0 ? taken.problems : ["empty"]).map(subject) }
  }
  const body = passing(paragraphs, PARAGRAPH_TASK, allowed, CAMPAIGN_PARAGRAPHS.max)
  if (body.problems.length > 0) {
    return { problems: body.problems.map((each) => `body.${each}`) }
  }
  if (body.texts.length < CAMPAIGN_PARAGRAPHS.min) {
    return { problems: ["body.empty"] }
  }
  const words = countWords(body.texts.join(" "))
  if (words < CAMPAIGN_BODY_WORDS.min || words > CAMPAIGN_BODY_WORDS.max) {
    return { problems: ["body.words"] }
  }
  const line =
    typeof preheader === "string" ? passing([preheader], PREHEADER_TASK, allowed, 1) : null
  return {
    email: {
      subjects: taken.texts,
      preheader: line?.texts[0] ?? null,
      paragraphs: body.texts,
    },
  }
}

const smsSchema = z.object({ texts: z.array(z.unknown()).max(CAMPAIGN_SMS_COUNT * 2) }).strict()

/** A text's answer as the texts that fit one SMS with its end, or why it was refused. */
export function campaignSmsOf(raw: string, allowed: CampaignAllowed): CampaignSmsResult {
  const parsed = smsSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const end = allowed.sms ?? { shop: "", opt_out: "" }
  const fits = (text: string): string[] =>
    smsLength(composeSms(text, end.shop, end.opt_out)).parts > 1 ? ["sms_length"] : []
  const taken = passing(parsed.data.texts, SMS_TASK, allowed, CAMPAIGN_SMS_COUNT, fits)
  if (taken.texts.length === 0) {
    return { problems: taken.problems.length > 0 ? taken.problems : ["empty"] }
  }
  return { texts: taken.texts }
}
