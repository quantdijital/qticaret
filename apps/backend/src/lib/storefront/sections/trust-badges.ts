import { z } from "@medusajs/framework/zod"
import { placement } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The shop's trust badges as a strip (`settings.trust_badges`, up to four,
 * adr/0049 Ek 2026-11-06): the section holds no badges of its own, only
 * where it stands and how it is drawn.
 */

/**
 * The card's settings (adr/0077 §10 Ek): mirrors `@qticaret/types`'
 * `TRUST_CARD_SETTINGS` and `TRUST_CARD_DEFAULTS` (the backend reads no
 * runtime value from that package); a unit test keeps them equal.
 */
export const TRUST_CARD_SETTINGS = {
  lift: ["off", "on"],
} as const

export const TRUST_CARD_DEFAULTS = { lift: "off" } as const

const common = { ...bodyFields, type: z.literal("trust_badges") }

/** Today's drawing: a tinted strip, cards two by two on a phone. */
const strip = z.object({ ...common, variant: defaultVariant("trust_badges") }).strict()

/** GB4 (adr/0049 Ek 2026-11-14 §3.2): boxes split by hairlines, at the page's width. */
const lined = z.object({ ...common, variant: z.literal("lined") }).strict()

/**
 * One white floating box, the badges split by thin rules (adr/0077 §10 Ek);
 * while `lift` is on it rises over the bottom of the section before it.
 */
const card = z
  .object({
    ...common,
    variant: z.literal("card"),
    lift: z
      .custom<(typeof TRUST_CARD_SETTINGS.lift)[number]>(
        (value) => (TRUST_CARD_SETTINGS.lift as readonly unknown[]).includes(value),
        VARIANT_ERROR
      )
      .default(TRUST_CARD_DEFAULTS.lift),
  })
  .strict()

export const TRUST_BADGES_BRANCHES: Readonly<
  Record<SectionVariant<"trust_badges">, VariantBranch>
> = { strip, lined, card }

export const trustBadges = z.discriminatedUnion("variant", [strip, lined, card], VARIANT_ERROR)

/** On a category page: above or below its products. */
export const placedTrustBadges = z.discriminatedUnion(
  "variant",
  [strip.extend({ placement }), lined.extend({ placement }), card.extend({ placement })],
  VARIANT_ERROR
)
