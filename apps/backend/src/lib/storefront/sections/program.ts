import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * Where the program stands (`@qticaret/types`' `PROGRAM_PLACES`): its own
 * section (`section`, absent: as drawn before the setting) or a tab beside
 * the product's description and specs (`tab`).
 */
export const PROGRAM_PLACES = ["section", "tab"] as const

/**
 * A dated product's program on its page (adr/0078): the steps staff wrote
 * on the product (`bookable.program`), drawn below the product's own
 * block. The section holds only its title and how it is drawn; a product
 * without a program shows nothing. Needs `catalog.booking` (`requires.ts`).
 * `place`: its own section (absent) or a tab beside the description.
 */
const common = {
  ...bodyFields,
  type: z.literal("program"),
  title,
  place: z.enum(PROGRAM_PLACES).optional(),
}

/** The steps down a line, each open. */
const timeline = z.object({ ...common, variant: defaultVariant("program") }).strict()

/** Each step a row that opens on its own; the first open. */
const accordion = z.object({ ...common, variant: z.literal("accordion") }).strict()

export const PROGRAM_BRANCHES: Readonly<Record<SectionVariant<"program">, VariantBranch>> = {
  timeline,
  accordion,
}

export const program = z.discriminatedUnion("variant", [timeline, accordion], VARIANT_ERROR)

export type ProgramSection = z.infer<typeof program>
