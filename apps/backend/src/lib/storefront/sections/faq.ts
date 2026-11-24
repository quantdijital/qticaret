import { z } from "@medusajs/framework/zod"
import { contentDoc, fitsBare } from "../../content"
import type { BareDocLimits, ContentDoc } from "../../content"
import { unknownDocTokens } from "../../shop/tokens"
import { placement, shopText, text, title } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The FAQ section's settings (docs/tema/bilesen-denetimi (b) 8): the first
 * question open, and one open at a time; both off, as before. Mirrors
 * `@qticaret/types`' `FAQ_SETTINGS` and `FAQ_DEFAULTS` (the backend reads
 * no runtime value from that package); a unit test keeps them equal.
 */
export const FAQ_SETTINGS = {
  open_first: ["off", "on"],
  single_open: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof FAQ_SETTINGS
type Step<S extends Setting> = (typeof FAQ_SETTINGS)[S][number]

/** A new section's steps, filled where one saved before them has none (no migration). */
export const FAQ_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  open_first: "off",
  single_open: "off",
}

/**
 * The FAQ's bounds (adr/0073 Ek 2026-11-24 (2)): a question's and a
 * group heading's characters, a plain answer's (saved before rich
 * answers), a rich answer's characters of text, the rows a section holds.
 * Mirrors `@qticaret/types`' `FAQ_LIMITS`; a unit test keeps them equal.
 */
export const FAQ_LIMITS = {
  question: 200,
  heading: 120,
  answer: 600,
  answerChars: 1500,
  items: 40,
} as const

/** An answer's document: a footer text block's nodes, within the answer's characters. */
export const FAQ_ANSWER_LIMITS: BareDocLimits = {
  nodes: 200,
  textLength: FAQ_LIMITS.answerChars,
  depth: 4,
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = FAQ_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(FAQ_DEFAULTS[name])
}

interface Node {
  text?: unknown
  content?: unknown
}

/** Whether a document holds any words (an answer of empty paragraphs is no answer). */
export function hasWords(doc: ContentDoc): boolean {
  const stack: Node[] = [doc]
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (typeof node.text === "string" && node.text.trim() !== "") {
      return true
    }
    if (Array.isArray(node.content)) {
      stack.push(...(node.content as Node[]))
    }
  }
  return false
}

/**
 * An answer as the editor sent it: a content document (adr/0019, its
 * links checked there) of paragraphs, line breaks and lists only, with
 * words in it, its `{belirteç}`s the shop's details.
 */
export const faqAnswer = z.unknown().transform((value, ctx): ContentDoc => {
  // The answer's own bounds first, on the raw value: a page-sized document is refused before
  // the full parse (security review L1); an odd node there throws and is refused the same way
  let small: boolean
  try {
    small = fitsBare(value as ContentDoc, FAQ_ANSWER_LIMITS)
  } catch {
    small = false
  }
  const parsed = small ? contentDoc.safeParse(value) : null
  if (!parsed) {
    ctx.addIssue({ code: "custom", message: "storefront_layout.faq_answer_invalid" })
    return z.NEVER
  }
  if (!parsed.success || !fitsBare(parsed.data, FAQ_ANSWER_LIMITS) || !hasWords(parsed.data)) {
    ctx.addIssue({ code: "custom", message: "storefront_layout.faq_answer_invalid" })
    return z.NEVER
  }
  if (unknownDocTokens(parsed.data).length > 0) {
    ctx.addIssue({ code: "custom", message: "storefront_layout.token_unknown" })
    return z.NEVER
  }
  return parsed.data
})

/** A row: a question with its answer, rich (`body`) or plain from before (`answer`). */
export interface FaqQuestion {
  question: string
  body?: ContentDoc
  answer?: string
}

/** A row: a group's heading, the questions under it until the next. */
export interface FaqHeading {
  heading: string
}

export type FaqRow = FaqQuestion | FaqHeading

export const isFaqHeading = (row: FaqRow): row is FaqHeading => "heading" in row

/**
 * One row, either kind (one object, so a refusal names the field): a
 * heading alone, or a question with exactly one answer.
 */
const row = z
  .object({
    question: text(FAQ_LIMITS.question).optional(),
    body: faqAnswer.optional(),
    answer: shopText(FAQ_LIMITS.answer).optional(),
    heading: text(FAQ_LIMITS.heading).optional(),
  })
  .strict()
  .superRefine((each, ctx) => {
    const answers = Number(each.body !== undefined) + Number(each.answer !== undefined)
    const fits =
      each.heading !== undefined
        ? each.question === undefined && answers === 0
        : each.question !== undefined && answers === 1
    if (!fits) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.section_invalid" })
    }
  })
  .transform((each): FaqRow =>
    each.heading !== undefined ? { heading: each.heading } : (each as FaqQuestion)
  )

/** What every variant holds: the questions in order, and how they open. */
const common = {
  ...bodyFields,
  type: z.literal("faq"),
  title,
  items: z.array(row).min(1).max(FAQ_LIMITS.items),
  open_first: setting("open_first"),
  single_open: setting("single_open"),
}

/** Today's drawing: the heading beside the questions. */
const standard = z.object({ ...common, variant: defaultVariant("faq") }).strict()

/** "Sayfa SSS'si": a content page's questions page, its groups' topics and the ways to reach the shop beside. */
const page = z.object({ ...common, variant: z.literal("page") }).strict()

/** What an FAQ read as each variant keeps (`storedSection`). */
export const FAQ_BRANCHES: Readonly<Record<SectionVariant<"faq">, VariantBranch>> = {
  standard,
  page,
}

/**
 * Questions and answers, shown on the page; never `FAQPage` structured
 * data (docs/13 §5). On the home and product pages: `standard`.
 */
export const faq = z.discriminatedUnion("variant", [standard], VARIANT_ERROR)

/** On a content page: the questions page (`page`) too. */
export const pageFaq = z.discriminatedUnion("variant", [standard, page], VARIANT_ERROR)

/** On a category page: above or below its products. */
export const placedFaq = z.discriminatedUnion(
  "variant",
  [standard.extend({ placement })],
  VARIANT_ERROR
)

export type FaqSection = z.infer<typeof pageFaq>
