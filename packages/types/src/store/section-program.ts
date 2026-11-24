/**
 * A dated product's program (adr/0078): its ordered steps (a tour's days,
 * a course's lessons, an event's sessions) as `GET /store/products/:id/
 * program` gives them, and the product page's `program` section that
 * draws them. Sector-free: "gün" or "adım" is the product's choice
 * (`unit`), the tags a closed list the storefront names.
 *
 * `PROGRAM_TAGS`, `PROGRAM_UNITS` and `PROGRAM_LIMITS` mirror the
 * backend's `lib/booking/program.ts`; a unit test keeps them equal.
 */

import type { MediaDerivatives } from "./catalog.js"

/** How an unnamed step is called: "{{n}}. gün" or "{{n}}. adım". */
export const PROGRAM_UNITS = ["day", "step"] as const
export type ProgramUnit = (typeof PROGRAM_UNITS)[number]

/** What a step includes. */
export const PROGRAM_TAGS = [
  "breakfast",
  "lunch",
  "dinner",
  "accommodation",
  "transport",
  "free_time",
] as const
export type ProgramTag = (typeof PROGRAM_TAGS)[number]

/** The bounds a save is held to: steps, a label's and a title's characters, a body's text. */
export const PROGRAM_LIMITS = {
  steps: 30,
  label: 40,
  title: 120,
  bodyChars: 2000,
  bodyNodes: 400,
  bodyDepth: 4,
} as const

/** A step's picture as the media library knows it. */
export interface StoreProgramImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

/** One step: its own label (null: numbered by the unit), title, body as rendered HTML, picture, tags. */
export interface StoreProgramStep {
  label: string | null
  title: string
  /** Rendered and escaped by the server from a narrowed document (paragraphs, lists, links). */
  body_html: string | null
  image: StoreProgramImage | null
  tags: ProgramTag[]
}

/** `GET /store/products/:id/program`'s `program`: null when the product has none. */
export interface StoreProgram {
  unit: ProgramUnit
  steps: StoreProgramStep[]
}

/** A tag off this build's list (a newer backend's) is left out. */
export const programTagsOf = (tags: readonly string[]): ProgramTag[] =>
  PROGRAM_TAGS.filter((tag) => tags.includes(tag))
