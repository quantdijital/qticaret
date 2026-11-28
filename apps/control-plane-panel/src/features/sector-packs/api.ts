import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"

/**
 * A sector pack as the control plane offers it (adr/0061 C12): what its
 * manifest says (the name and description are the pack's own Turkish
 * text, data like a package's name) and how many items of each kind it
 * holds. Any staff member may read them.
 */
export interface SectorPackSummary {
  code: string
  version: number
  name: string
  description: string
  counts: {
    attribute_templates: number
    attributes: number
    categories: number
    flags: number
    seo_templates: number
    /** Ready-made storefront looks (adr/0063). */
    presets: number
  }
  /** Its ready-made looks (adr/0063 task 2.7), the first the default; none for most packs. */
  presets: PresetSummary[]
}

/** A ready-made look as the new-shop wizard shows it (its name and text are the pack's own). */
export interface PresetSummary {
  code: string
  version: number
  name: string
  description: string
  tone: "light" | "dark"
  /** The control plane can show its picture (`presetPreviewPath`). */
  preview: boolean
}

/** Where a look's picture is read (every staff role). */
export const presetPreviewPath = (pack: string, code: string): string =>
  `/admin/cp/sector-packs/${encodeURIComponent(pack)}/presets/${encodeURIComponent(code)}/preview`

/** A pack's looks; none when the list does not have the pack. */
export const presetsOf = (
  packs: readonly SectorPackSummary[] | undefined,
  pack: string
): PresetSummary[] => packs?.find((each) => each.code === pack)?.presets ?? []

/**
 * The look a shop gets: the one chosen when it is the pack's, else the
 * pack's first (the control plane's default too); null when it has none.
 */
export function chosenPreset(
  packs: readonly SectorPackSummary[] | undefined,
  pack: string,
  chosen: string
): PresetSummary | null {
  const looks = presetsOf(packs, pack)
  return looks.find((look) => look.code === chosen) ?? looks[0] ?? null
}

/** The pack a shop with none on its record is set up with. */
export const DEFAULT_SECTOR_PACK = "general"

export const SECTOR_PACK_COUNTS = [
  "attribute_templates",
  "attributes",
  "categories",
  "flags",
  "seo_templates",
  "presets",
] as const satisfies readonly (keyof SectorPackSummary["counts"])[]

export const sectorPacksQuery = () =>
  queryOptions({
    queryKey: ["sector-packs"],
    queryFn: () => api<{ sector_packs: SectorPackSummary[] }>("/admin/cp/sector-packs"),
    // Release data: the same until the control plane is updated
    staleTime: 10 * 60_000,
  })

/** A pack's name, or its code when the list does not have it (yet, or any more). */
export const packName = (packs: readonly SectorPackSummary[] | undefined, code: string): string =>
  packs?.find((pack) => pack.code === code)?.name ?? code
