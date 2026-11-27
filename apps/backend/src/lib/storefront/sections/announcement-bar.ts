import { z } from "@medusajs/framework/zod"
import { base, shopText } from "../layout-fields"
import { storefrontLink } from "../menus"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

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

/**
 * The top strip above the header (owner's decision 2026-11-27, adr/0066
 * Ek): up to five lines of the shop's words and how they show, in one of
 * two designs. `graphite`, the dark bar drawn before variants: the lines,
 * their small button and from 1024 px the top links and the phone at its
 * end. `light`, the thin light strip the catalog header drew of its own:
 * the first line as a note (a link when `link` goes somewhere), the top
 * links and, when asked, "Hesabım". No lines: only the links and the phone,
 * from 1024 px. `links` and `phone` off are written `false`; absent: shown,
 * as every bar saved before them. `account` is written once switched on.
 */
const common = {
  ...base,
  type: z.literal("announcement_bar"),
  lines: z.array(shopText(120)).max(5),
  mode: setting("mode"),
  interval: setting("interval"),
  pause_button: setting("pause_button"),
  hover_pause: setting("hover_pause"),
  align: setting("align"),
  size: setting("size"),
  tone: setting("tone"),
  // The small button beside the lines; absent until written, so a bar saved before it prints as it did
  link: storefrontLink.nullable().optional(),
  /** The shop's top links in the strip (from 1024 px). */
  links: z.boolean().optional(),
}

const graphite = z
  .object({
    ...common,
    variant: defaultVariant("announcement_bar"),
    /** The shop's phone at the bar's end (from 1024 px). */
    phone: z.boolean().optional(),
  })
  .strict()

const light = z
  .object({
    ...common,
    variant: z.literal("light"),
    /** "Hesabım" written at the strip's end. */
    account: z.boolean().optional(),
  })
  .strict()

export const ANNOUNCEMENT_BRANCHES: Readonly<
  Record<SectionVariant<"announcement_bar">, VariantBranch>
> = { graphite, light }

/** The header group's top strip in either design. */
export const announcementBar = z.discriminatedUnion("variant", [graphite, light], VARIANT_ERROR)

export type AnnouncementBar = z.infer<typeof announcementBar>
