import { ValidationError } from "../../errors"
import { themeSection, withCardDefaults } from "../../../modules/platform-settings/sections/theme"
import type { ThemeSettings } from "../../../modules/platform-settings/sections"
import { layoutDocument } from "../layout"
import type { LayoutDocument } from "../layout"
import type { LayoutSettings } from "../layout-settings"
import type { PresetGroups, ResolvedPreset } from "./resolve"

/** The preset a design was last given (`settings.preset`, adr/0063 §2). */
export interface AppliedPreset {
  pack: string
  code: string
  version: number
}

const fieldOf = (error: { issues: { path: PropertyKey[] }[] }, prefix: string): string => {
  const path = error.issues[0]?.path ?? []
  return [prefix, ...path.map(String)].join(".")
}

/** The frame's groups a preset may leave to the shop (adr/0063 §4): the header and footer. */
export const SHOP_FRAME_GROUPS = ["header", "footer"] as const
export type ShopFrame = Pick<PresetGroups, (typeof SHOP_FRAME_GROUPS)[number]>

const idOf = (section: unknown): string => {
  const id = (section as { id?: unknown } | null)?.id
  return typeof id === "string" ? id : "?"
}

/**
 * The preset's groups with the shop's frame kept where the preset leaves it
 * empty (adr/0063 §4, as with menus): a header or footer the preset writes no
 * section for, or whose every section was dropped, carries the shop's own
 * sections there (an announcement bar is not lost to a look that has none);
 * one the preset fills is the preset's. `kept` names them, `header.duyurular`.
 */
export function withShopFrame(
  groups: PresetGroups,
  shop: ShopFrame
): { groups: PresetGroups; kept: string[] } {
  const out: PresetGroups = { ...groups }
  const kept: string[] = []
  for (const group of SHOP_FRAME_GROUPS) {
    if (groups[group].length === 0 && shop[group].length > 0) {
      out[group] = [...shop[group]]
      kept.push(...shop[group].map((section) => `${group}.${idOf(section)}`))
    }
  }
  return { groups: out, kept }
}

/**
 * The preset's theme settings through the theme section's own schema, its
 * contrast rule included (adr/0063 §2); a theme this build does not draw is
 * refused there too. Refused, nothing is written.
 */
export function presetTheme(raw: unknown): ThemeSettings {
  // A preset written before the card's variant and E5 fields draws its cards as before
  const parsed = themeSection.full.safeParse(withCardDefaults(raw))
  if (!parsed.success) {
    throw new ValidationError("storefront_preset.theme_invalid", {
      field: fieldOf(parsed.error, "theme"),
    })
  }
  return parsed.data
}

/**
 * The draft a preset makes (adr/0063 §4): its sections, theme and menu set
 * in place of the draft's, the applied preset named, the shop's own trust
 * badges, colour swatches and "Az kaldı" kept as the draft has them. Held
 * to the editor's schema as a whole: one the schema refuses writes nothing.
 */
export function presetDocument(
  resolved: Pick<ResolvedPreset, "groups" | "menus"> & {
    /** The shop's content page layouts, kept: a preset names no page yet (adr/0073 §4). */
    pages?: readonly unknown[]
  },
  theme: ThemeSettings,
  preset: AppliedPreset,
  kept: Pick<LayoutSettings, "trust_badges" | "color_swatches" | "low_stock">
): LayoutDocument {
  const parsed = layoutDocument.safeParse({
    ...resolved.groups,
    pages: resolved.pages ?? [],
    settings: {
      trust_badges: kept.trust_badges,
      color_swatches: kept.color_swatches,
      low_stock: kept.low_stock,
      theme,
      menus: resolved.menus,
      preset,
    },
  })
  if (!parsed.success) {
    throw new ValidationError("storefront_preset.layout_invalid", {
      field: fieldOf(parsed.error, "layout"),
    })
  }
  return parsed.data
}
