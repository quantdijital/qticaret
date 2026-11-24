import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * A dated product's program on its page (adr/0078): the steps staff wrote
 * on the product (`bookable.program`), drawn below the product's own
 * block. The section holds only its title and how it is drawn; a product
 * without a program shows nothing. Needs `catalog.booking` (`requires.ts`).
 */
const common = {
  ...bodyFields,
  type: z.literal("program"),
  title,
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
