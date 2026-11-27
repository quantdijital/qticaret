import { z } from "@medusajs/framework/zod"
import { base, shopText } from "../layout-fields"
import { storefrontLink } from "../menus"

/**
 * The announcement bar's settings (docs/tema/bilesen-denetimi (b) 6): how
 * it shows more than one line (only the first, as before; taking turns;
 * side by side) and, when they take turns, how long each stays and how the
 * turning stops; where its lines sit and how big the bar is (adr/0049 Ek
 * 2026-11-15). Mirrors `@qticaret/types`' `ANNOUNCEMENT_SETTINGS` and
 * `ANNOUNCEMENT_DEFAULTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const ANNOUNCEMENT_SETTINGS = {
  mode: ["first", "rotate", "inline"],
  interval: ["slow", "medium", "fast"],
  pause_button: ["always", "hover"],
  hover_pause: ["on", "off"],
  align: ["auto", "left", "center", "right"],
  size: ["small", "medium", "large"],
  tone: ["graphite", "primary"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof ANNOUNCEMENT_SETTINGS
type Step<S extends Setting> = (typeof ANNOUNCEMENT_SETTINGS)[S][number]

/** A new bar's steps, filled where a bar saved before them has none (no migration). */
export const ANNOUNCEMENT_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  mode: "first",
  interval: "medium",
  pause_button: "always",
  hover_pause: "on",
  align: "auto",
  size: "medium",
  tone: "graphite",
}

export const ANNOUNCEMENT_SETTING_NAMES = Object.keys(ANNOUNCEMENT_SETTINGS) as Setting[]

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = ANNOUNCEMENT_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(ANNOUNCEMENT_DEFAULTS[name])
}

/** The header's announcement bar: one to five lines of the shop's words, and how they show. */
export const announcementBar = z
  .object({
    ...base,
    type: z.literal("announcement_bar"),
    lines: z.array(shopText(120)).min(1).max(5),
    mode: setting("mode"),
    interval: setting("interval"),
    pause_button: setting("pause_button"),
    hover_pause: setting("hover_pause"),
    align: setting("align"),
    size: setting("size"),
    tone: setting("tone"),
    // The small button beside the lines; absent until written, so a bar saved before it prints as it did
    link: storefrontLink.nullable().optional(),
  })
  .strict()

export type AnnouncementBar = z.infer<typeof announcementBar>
