/**
 * What a look's card shows without its document (adr/0064 §3, Ek
 * 2026-11-17 §2.2): where it came from, its colours and faces, how many
 * sections each group has and the home page's first section types, for the
 * panel to draw its sketch (K1 a). Read loosely, from a stored document or
 * a ready-made look's unresolved layout alike: a value it cannot read is
 * null, never a failure.
 */

export const DESIGN_GROUPS = ["header", "home", "footer", "product", "category"] as const
export type DesignGroup = (typeof DESIGN_GROUPS)[number]

/** Where a saved look came from: a ready-made look, another saved look, the shop's own work. */
export type DesignSource = "preset" | "design" | "own"

/** What made it: an apply, a restore or a discard replacing the draft, or the shop saving it. */
export type DesignReason = "preset_apply" | "design_apply" | "restore" | "discard" | "manual"

export const HOME_TYPES_SHOWN = 8

export interface DesignSummary {
  source: DesignSource
  /** The ready-made or saved look's name at the time; null for the shop's own. */
  source_name: string | null
  preset: { pack: string; code: string; version: number } | null
  colors: { primary: string | null; accent: string | null; background: string | null }
  fonts: { heading: string | null; body: string | null }
  sections: Record<DesignGroup, number>
  /** The home page's first section types, in order. */
  home_types: string[]
  /** Changed since it was applied (`settings.design`'s digest). */
  edited: boolean
  /** Null for a ready-made look's card. */
  reason: DesignReason | null
}

/** A design's parts as the summary reads them. */
export interface SummaryParts {
  groups: Partial<Record<DesignGroup, unknown>>
  theme: unknown
  preset: unknown
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const string = (value: unknown): string | null => (typeof value === "string" ? value : null)

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function presetOf(value: unknown): DesignSummary["preset"] {
  const { pack, code, version } = record(value)
  return typeof pack === "string" && typeof code === "string" && typeof version === "number"
    ? { pack, code, version }
    : null
}

export function designSummary(
  parts: SummaryParts,
  origin: Pick<DesignSummary, "source" | "source_name" | "edited" | "reason">
): DesignSummary {
  const theme = record(parts.theme)
  const colors = record(theme["colors"])
  const typography = record(theme["typography"])
  const sections = Object.fromEntries(
    DESIGN_GROUPS.map((group) => [group, list(parts.groups[group]).length])
  ) as Record<DesignGroup, number>
  return {
    ...origin,
    preset: presetOf(parts.preset),
    colors: {
      primary: string(colors["primary"]),
      accent: string(colors["accent"]),
      background: string(colors["background"]),
    },
    fonts: { heading: string(typography["heading"]), body: string(typography["body"]) },
    sections,
    home_types: list(parts.groups.home)
      .map((section) => string(record(section)["type"]))
      .filter((type): type is string => type !== null)
      .slice(0, HOME_TYPES_SHOWN),
  }
}

/** A stored document's parts (any shape): its groups, theme and preset label. */
export function partsOf(document: unknown): SummaryParts {
  const doc = record(document)
  const settings = record(doc["settings"])
  return {
    groups: Object.fromEntries(DESIGN_GROUPS.map((group) => [group, doc[group]])),
    theme: settings["theme"],
    preset: settings["preset"],
  }
}
