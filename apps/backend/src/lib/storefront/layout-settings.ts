import { z } from "@medusajs/framework/zod"
import { TRUST_ICONS } from "../../modules/platform-settings/sections/storefront"
import type { StorefrontSettings, TrustIcon } from "../../modules/platform-settings/sections"
import { shopText, text } from "./layout-fields"

/**
 * The theme's shared settings in the design document (adr/0049 Ek
 * 2026-11-06): what several pages draw alike, drafted and published with
 * the sections. The trust badges (the home, product and category pages'
 * strip, the product page's assurances, the cart), the colour names shown
 * as swatches (product cards, filters, the product page's options) and
 * the product card's "Az kaldı" line.
 *
 * Each part is null until the shop writes it here: readers then take the
 * storefront settings' old field (Vitrin tercihleri before the move), so a
 * shop sees the same storefront without a migration.
 */

export const SETTINGS_LIMITS = {
  badges: 4,
  badgeTitle: 40,
  badgeText: 80,
  swatches: 100,
  swatchLabel: 40,
  lowStock: { min: 1, max: 1000, default: 3 },
} as const

const HEX_COLOR = /^#[0-9a-f]{6}$/

const trustBadge = z
  .object({
    icon: z.enum(TRUST_ICONS),
    title: shopText(SETTINGS_LIMITS.badgeTitle),
    text: shopText(SETTINGS_LIMITS.badgeText).nullable().default(null),
  })
  .strict()

const swatch = z
  .object({
    label: text(SETTINGS_LIMITS.swatchLabel),
    hex: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HEX_COLOR, { message: "storefront_layout.color_invalid" }),
  })
  .strict()

const swatches = z
  .array(swatch)
  .max(SETTINGS_LIMITS.swatches)
  .refine(
    (list) => new Set(list.map((each) => each.label.toLocaleLowerCase("tr"))).size === list.length,
    { message: "storefront_layout.color_duplicate" }
  )

/** "Az kaldı" on a product card at `threshold` units or fewer, never the number itself. */
const lowStock = z
  .object({
    enabled: z.boolean(),
    threshold: z
      .number()
      .int()
      .min(SETTINGS_LIMITS.lowStock.min)
      .max(SETTINGS_LIMITS.lowStock.max)
      .default(SETTINGS_LIMITS.lowStock.default),
  })
  .strict()

export const UNSET_SETTINGS = { trust_badges: null, color_swatches: null, low_stock: null } as const

export const layoutSettings = z
  .object({
    trust_badges: z.array(trustBadge).max(SETTINGS_LIMITS.badges).nullable().default(null),
    color_swatches: swatches.nullable().default(null),
    low_stock: lowStock.nullable().default(null),
  })
  .strict()
  // A document from before the settings reads with every part unset
  .default({ ...UNSET_SETTINGS })

export type LayoutSettings = z.infer<typeof layoutSettings>

/** The settings as the storefront applies them: every part written, here or in the old place. */
export interface ShownSettings {
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  color_swatches: { label: string; hex: string }[]
  /** "Az kaldı" at this many units or fewer; 0: never. */
  low_stock_threshold: number
}

type Legacy = Pick<StorefrontSettings, "trust_badges" | "color_swatches" | "low_stock_threshold">

/** A threshold the old field held (0: off) as the new part reads it. */
export const lowStockOf = (threshold: number): NonNullable<LayoutSettings["low_stock"]> =>
  threshold > 0
    ? { enabled: true, threshold: Math.min(threshold, SETTINGS_LIMITS.lowStock.max) }
    : { enabled: false, threshold: SETTINGS_LIMITS.lowStock.default }

/**
 * Each unset part filled from the storefront settings' old field: what the
 * editor opens and what the storefront shows until the shop writes it here.
 */
export function withLegacy(settings: LayoutSettings, legacy: Legacy): LayoutSettings {
  return {
    trust_badges:
      settings.trust_badges ??
      legacy.trust_badges.map((badge) => ({
        icon: badge.icon,
        title: badge.title,
        text: badge.text,
      })),
    color_swatches:
      settings.color_swatches ?? legacy.color_swatches.map(({ label, hex }) => ({ label, hex })),
    low_stock: settings.low_stock ?? lowStockOf(legacy.low_stock_threshold),
  }
}

/** The settings as applied: the old field where a part is unset. */
export function shownSettings(settings: LayoutSettings, legacy: Legacy): ShownSettings {
  const filled = withLegacy(settings, legacy)
  const low = filled.low_stock ?? lowStockOf(legacy.low_stock_threshold)
  return {
    trust_badges: filled.trust_badges ?? [],
    color_swatches: filled.color_swatches ?? [],
    low_stock_threshold: low.enabled ? low.threshold : 0,
  }
}

/** A stored document's settings, read on their own; an unreadable part is unset. */
export function storedSettings(document: unknown): LayoutSettings {
  const raw = (document as { settings?: unknown } | null)?.settings
  const parsed = layoutSettings.safeParse(raw)
  return parsed.success ? parsed.data : { ...UNSET_SETTINGS }
}
