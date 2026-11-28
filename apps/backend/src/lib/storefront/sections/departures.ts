import { z } from "@medusajs/framework/zod"
import { optional, recordId, shopText, title } from "../layout-fields"
import { headLines } from "./head-lines"
import { bodyFields } from "./look"
import { collectionSource } from "./sources"

/**
 * Upcoming departures (`departures`, adr/0077 §10): an optional title and
 * intro, whose departures (every dated product's, a category's or a
 * collection's), how many, and the list's layout. A flagged section
 * (`requires.ts`: `catalog.booking`); its rows are read live by the
 * storefront (`GET /store/departures`), nothing priced is kept here.
 * Mirrors `@qticaret/types`' `DEPARTURES_LIMITS`, `DEPARTURES_SETTINGS`
 * and `DEPARTURES_DEFAULTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const DEPARTURES_LIMITS = {
  limit: { min: 3, max: 12, default: 6 },
  intro: 240,
  per_product: 2,
} as const

export const DEPARTURES_SETTINGS = {
  layout: ["list", "cards"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof DEPARTURES_SETTINGS
type Step<S extends Setting> = (typeof DEPARTURES_SETTINGS)[S][number]

export const DEPARTURES_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  layout: "list",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = DEPARTURES_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(DEPARTURES_DEFAULTS[name])
}

/** Whose departures: every dated product's, a category's (its shown subtree) or a collection's. */
export const departuresSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("category"), category_id: recordId }).strict(),
  collectionSource,
])

export const departures = z
  .object({
    ...bodyFields,
    type: z.literal("departures"),
    /** None: the storefront's own words. */
    title,
    intro: optional(shopText(DEPARTURES_LIMITS.intro)),
    source: departuresSource.default({ kind: "all" }),
    limit: z
      .number()
      .int()
      .min(DEPARTURES_LIMITS.limit.min)
      .max(DEPARTURES_LIMITS.limit.max)
      .default(DEPARTURES_LIMITS.limit.default),
    layout: setting("layout"),
    /** The line over the heading and the hand note beside it (`head-lines.ts`). */
    ...headLines,
  })
  .strict()

export type DeparturesSection = z.infer<typeof departures>
