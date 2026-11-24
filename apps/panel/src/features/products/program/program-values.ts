import type { JSONContent } from "@tiptap/react"
import { z } from "zod"
import { PROGRAM_LIMITS, PROGRAM_TAGS, PROGRAM_UNITS } from "@/features/products/api/program"
import type { Program, ProgramImage, ProgramStep } from "@/features/products/api/program"
import { docTextLength, hasSummaryText } from "@/features/products/summary-doc"

/**
 * The Program card's form (adr/0078): the steps as the person edits them, the
 * label and title as text, the body a document (the list keeps each row's
 * identity itself). Pure, so the card and the tests share it.
 */

export const EMPTY_BODY: JSONContent = { type: "doc", content: [] }

const P = "products.program.errors"

const stepSchema = z.object({
  label: z
    .string()
    .trim()
    .max(PROGRAM_LIMITS.label, { message: `${P}.labelTooLong` }),
  title: z
    .string()
    .trim()
    .min(1, { message: `${P}.titleRequired` })
    .max(PROGRAM_LIMITS.title, { message: `${P}.titleTooLong` }),
  body: z.custom<JSONContent>().refine((doc) => docTextLength(doc) <= PROGRAM_LIMITS.bodyChars, {
    message: `${P}.bodyTooLong`,
  }),
  image: z.custom<ProgramImage | null>(),
  tags: z.array(z.enum(PROGRAM_TAGS)),
})

export const programSchema = z.object({
  unit: z.enum(PROGRAM_UNITS),
  steps: z.array(stepSchema).max(PROGRAM_LIMITS.steps, { message: `${P}.tooMany` }),
})

export type ProgramValues = z.infer<typeof programSchema>
export type StepValues = ProgramValues["steps"][number]

/** An empty step, added at the end of the list. */
export const newStep = (): StepValues => ({
  label: "",
  title: "",
  body: EMPTY_BODY,
  image: null,
  tags: [],
})

/** The form from what the server keeps. */
export const valuesOf = (program: Program): ProgramValues => ({
  unit: program.unit,
  steps: program.steps.map((step) => ({
    label: step.label ?? "",
    title: step.title,
    body: step.body ?? EMPTY_BODY,
    image: step.image,
    tags: [...step.tags],
  })),
})

/** What the save sends: an empty label or body none, the tags in the list's order. */
export const programOf = (values: ProgramValues): Program => ({
  unit: values.unit,
  steps: values.steps.map((step): ProgramStep => ({
    label: step.label.trim() === "" ? null : step.label.trim(),
    title: step.title.trim(),
    body: hasSummaryText(step.body) ? step.body : null,
    image: step.image,
    tags: PROGRAM_TAGS.filter((tag) => step.tags.includes(tag)),
  })),
})

/** A step's tags with one turned on or off. */
export const toggledTags = (tags: readonly StepValues["tags"][number][], tag: string) =>
  PROGRAM_TAGS.filter((each) => (each === tag ? !tags.includes(each) : tags.includes(each)))

/** The label the storefront shows when the step has none: "1. Gün", "2. Adım". */
export const autoLabelKey = (unit: ProgramValues["unit"]) =>
  unit === "step" ? "products.program.autoStep" : "products.program.autoDay"
