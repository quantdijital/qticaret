import { z } from "@medusajs/framework/zod"
import { TRUST_ICONS } from "../../modules/platform-settings/sections/storefront"
import type {
  StorefrontSettings,
  ThemeSettings,
  TrustIcon,
} from "../../modules/platform-settings/sections"
import { shopText, text } from "./layout-fields"
import { menuSet } from "./layout-menus"
import { layoutTheme, legacyTheme, shownTheme, storedTheme } from "./layout-theme"
import type { ShownTheme } from "./layout-theme"

/**
 * The theme's shared settings in the design document (adr/0049 Ek
 * 2026-11-06): what several pages draw alike, drafted and published with
 * the sections. The trust badges (the home, product and category pages'
 * strip, the product page's assurances, the cart), the colour names shown
 * as swatches (product cards, filters, the product page's options) and
 * the product card's "Az kaldı" line.
 *
 * Since adr/0063 §3 also the theme's settings (`layout-theme.ts`) and a
 * menu set waiting to replace the shop's menus (`layout-menus.ts`).
 *
 * Each part is null until the shop writes it here: readers then take the
 * storefront settings' old field (Vitrin tercihleri before the move) or
 * the theme section, so a shop sees the same storefront without a
 * migration. The menu set's null means "leave the menus alone".
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

export const UNSET_SETTINGS = {
  trust_badges: null,
  color_swatches: null,
  low_stock: null,
  theme: null,
  menus: null,
} as const

/** Each part's own schema: a stored document is read part by part (`storedSettings`). */
const PARTS = {
  trust_badges: z.array(trustBadge).max(SETTINGS_LIMITS.badges).nullable().default(null),
  color_swatches: swatches.nullable().default(null),
  low_stock: lowStock.nullable().default(null),
  theme: layoutTheme,
  menus: menuSet.nullable().default(null),
}

export const layoutSettings = z
  .object(PARTS)
  .strict()
  // A document from before the settings reads with every part unset
  .default({ ...UNSET_SETTINGS })

export type LayoutSettings = z.infer<typeof layoutSettings>

/**
 * The settings as the storefront applies them: every part written, here or
 * in the old place. The menu set is not one: the live menus are the module's.
 */
export interface ShownSettings {
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  color_swatches: { label: string; hex: string }[]
  /** "Az kaldı" at this many units or fewer; 0: never. */
  low_stock_threshold: number
  theme: ShownTheme
}

/** Where an unset part is read from: the storefront section's old fields and the theme section. */
export type Legacy = Pick<
  StorefrontSettings,
  "trust_badges" | "color_swatches" | "low_stock_threshold" | "primary_color"
> & { theme: ThemeSettings }

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
    theme: settings.theme ?? legacyTheme(legacy.theme, legacy.primary_color),
    // Nothing to fill: an unset set leaves the live menus alone
    menus: settings.menus,
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
    theme: shownTheme(settings.theme, legacy.theme, legacy.primary_color),
  }
}

/**
 * A stored document's settings, read part by part (adr/0063 §3): a part
 * today's schema no longer reads is unset, the others stand. A theme written
 * without the settings' version is read with today's meaning (`storedTheme`).
 */
export function storedSettings(document: unknown): LayoutSettings {
  const raw = (document as { settings?: unknown } | null)?.settings
  const stored: Record<string, unknown> =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const read = <K extends keyof typeof PARTS>(key: K): LayoutSettings[K] => {
    const parsed = PARTS[key].safeParse(key === "theme" ? storedTheme(stored[key]) : stored[key])
    return (parsed.success ? parsed.data : null) as LayoutSettings[K]
  }
  return {
    trust_badges: read("trust_badges"),
    color_swatches: read("color_swatches"),
    low_stock: read("low_stock"),
    theme: read("theme"),
    menus: read("menus"),
  }
}
