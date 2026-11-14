import { z } from "@medusajs/framework/zod"
import { base, placement } from "../layout-fields"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The shop's trust badges as a strip (`settings.trust_badges`, up to four,
 * adr/0049 Ek 2026-11-06): the section holds no badges of its own, only
 * where it stands and how it is drawn.
 */

const common = { ...base, type: z.literal("trust_badges") }

/** Today's drawing: a tinted strip, cards two by two on a phone. */
const strip = z.object({ ...common, variant: defaultVariant("trust_badges") }).strict()

/** GB4 (adr/0049 Ek 2026-11-14 §3.2): boxes split by hairlines, at the page's width. */
const lined = z.object({ ...common, variant: z.literal("lined") }).strict()

export const TRUST_BADGES_BRANCHES: Readonly<
  Record<SectionVariant<"trust_badges">, VariantBranch>
> = { strip, lined }

export const trustBadges = z.discriminatedUnion("variant", [strip, lined], VARIANT_ERROR)

/** On a category page: above or below its products. */
export const placedTrustBadges = z.discriminatedUnion(
  "variant",
  [strip.extend({ placement }), lined.extend({ placement })],
  VARIANT_ERROR
)
