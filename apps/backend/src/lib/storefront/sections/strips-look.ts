import { z } from "@medusajs/framework/zod"

/**
 * The strips' look every strips drawing shares (adr/0049 Ek 2026-11-16):
 * the featured product's strips, the strip gallery and a product rail's
 * `strips` variant, under the same names, steps and defaults. Mirrors
 * `@qticaret/types`' `STRIPS_LOOK_SETTINGS`, `STRIPS_LOOK_DEFAULTS` and
 * `STRIPS_HEIGHTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const STRIPS_LOOK_SETTINGS = {
  strips_slant: ["soft", "medium", "steep"],
  strips_line: ["none", "thin", "medium", "thick"],
  strips_overlap: ["off", "on"],
  strips_dim: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type LookSetting = keyof typeof STRIPS_LOOK_SETTINGS

export const STRIPS_LOOK_DEFAULTS: {
  readonly [S in LookSetting]: (typeof STRIPS_LOOK_SETTINGS)[S][number]
} = {
  strips_slant: "medium",
  strips_line: "thin",
  strips_overlap: "off",
  strips_dim: "on",
}

/** The strips' height: the theme's low, medium and high proportions. */
export const STRIPS_HEIGHTS = ["low", "medium", "high"] as const

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * A closed list of steps, refused off it as a stale or forged editor (a
 * custom check: Medusa's answer drops an enum's key), its default filled
 * where a section saved before it has none (no migration).
 */
export const stepSetting = <T extends string>(steps: readonly T[], fallback: T) =>
  z
    .custom<T>((value) => (steps as readonly unknown[]).includes(value), SETTING_ERROR)
    .default(fallback)
