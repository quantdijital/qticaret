import { z } from "@medusajs/framework/zod"
import { contentDoc, fitsNarrowDoc } from "../content"
import type { ContentDoc } from "../content"
import { docPlainText, hasText } from "../content/plain"
import { ALT_MAX } from "../media"
import { isStorageUrl } from "../security/https-url"
import { isCleanText } from "../security/text"
import { isShopPath } from "../storefront/menus"

/**
 * A dated product's program (adr/0078): its ordered steps, a tour's days,
 * a course's lessons, an event's sessions. A closed shape, not free JSON:
 * each step a label (empty: "1. Gün" / "1. adım" by the unit), a title, a
 * short rich text, a picture of the media library and tags off a closed
 * list. Kept on `bookable.program`; the server checks every save.
 */

/** How an unnamed step is called: "{{n}}. gün" or "{{n}}. adım". */
export const PROGRAM_UNITS = ["day", "step"] as const
export type ProgramUnit = (typeof PROGRAM_UNITS)[number]

/** What a step includes, a closed list the storefront names in the shop's language. */
export const PROGRAM_TAGS = [
  "breakfast",
  "lunch",
  "dinner",
  "accommodation",
  "transport",
  "free_time",
] as const
export type ProgramTag = (typeof PROGRAM_TAGS)[number]

/**
 * The bounds: thirty steps (a month's tour; Rezdy and Bókun stop near it),
 * a title a line long, a body a few short paragraphs. `@qticaret/types`'
 * `PROGRAM_LIMITS` mirrors them; a unit test keeps them equal.
 */
export const PROGRAM_LIMITS = {
  steps: 30,
  label: 40,
  title: 120,
  bodyChars: 2000,
  bodyNodes: 400,
  bodyDepth: 4,
} as const

/** A step's body: paragraphs, line breaks and lists, with bold, italic and safe links. */
const BODY_NODES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
])

const BODY_LIMITS = {
  nodes: PROGRAM_LIMITS.bodyNodes,
  textLength: PROGRAM_LIMITS.bodyChars,
  depth: PROGRAM_LIMITS.bodyDepth,
}

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => isCleanText(value), { message: "booking.program_text_invalid" })

/** A step's body as the editor sends it: a narrowed document; one without text is none. */
const body = z.unknown().transform((value, ctx): ContentDoc | null => {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = contentDoc.safeParse(value)
  if (!parsed.success || !fitsNarrowDoc(parsed.data, BODY_NODES, BODY_LIMITS)) {
    ctx.addIssue({ code: "custom", message: "booking.program_body_invalid" })
    return z.NEVER
  }
  return hasText(parsed.data) ? parsed.data : null
})

/** A picture of the media library by its address; the workflow checks it is an upload. */
const image = z
  .object({
    url: z
      .string()
      .trim()
      .refine((value) => isCleanText(value) && (isStorageUrl(value) || isShopPath(value)), {
        message: "booking.program_image_unknown",
      }),
    alt: line(ALT_MAX)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : (value ?? null))),
  })
  .strict()

export const ProgramStep = z
  .object({
    label: line(PROGRAM_LIMITS.label)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : (value ?? null))),
    title: line(PROGRAM_LIMITS.title).min(1, { message: "booking.program_title_required" }),
    body: body.optional().transform((value) => value ?? null),
    image: image
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    tags: z
      .array(z.enum(PROGRAM_TAGS, { error: "booking.program_tag_unknown" }))
      .max(PROGRAM_TAGS.length)
      .optional()
      // Once each, in the list's order: the page reads the same however they were ticked
      .transform((tags) => PROGRAM_TAGS.filter((tag) => (tags ?? []).includes(tag))),
  })
  .strict()
export type ProgramStepType = z.infer<typeof ProgramStep>

/** POST /admin/products/:id/program: the whole program; no steps clears it. */
export const Program = z
  .object({
    unit: z.enum(PROGRAM_UNITS).default("day"),
    steps: z.array(ProgramStep).max(PROGRAM_LIMITS.steps, { message: "booking.program_too_long" }),
  })
  .strict()
export type ProgramType = z.infer<typeof Program>

/**
 * The program a row holds, read as today's schema reads a save; one that
 * no longer reads (a hand edit, an older shape) is none, so a page never
 * breaks on it. An empty one is none too.
 */
export function programOf(stored: unknown): ProgramType | null {
  if (stored === null || stored === undefined) {
    return null
  }
  const parsed = Program.safeParse(stored)
  return parsed.success && parsed.data.steps.length > 0 ? parsed.data : null
}

/** How much of a step's text its structured data repeats: a summary, not the page. */
export const ITINERARY_TEXT_MAX = 300

/** A program's steps as a trip's itinerary names them (adr/0078): title and plain text. */
export const programItinerary = (
  program: ProgramType
): { name: string; description: string | null }[] =>
  program.steps.map((step) => {
    const text = step.body ? docPlainText(step.body, ITINERARY_TEXT_MAX).text : ""
    return { name: step.title, description: text === "" ? null : text }
  })

/** The addresses of a program's pictures, once each. */
export const programImageUrls = (program: ProgramType): string[] => [
  ...new Set(program.steps.flatMap((step) => (step.image ? [step.image.url] : []))),
]
