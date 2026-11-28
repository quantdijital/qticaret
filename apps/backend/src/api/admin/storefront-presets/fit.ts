import type { MedusaContainer } from "@medusajs/framework/types"
import { SectorPackError, storefrontPreset } from "@qticaret/sector-packs"
import {
  PRESET_GROUPS,
  presetMarkers,
  resolvePreset,
} from "../../../lib/storefront/presets/resolve"
import type { SkippedRef } from "../../../lib/storefront/presets/resolve"
import { sectionTypesOff } from "../../../workflows/storefront/layout-flags"
import { presetLookups } from "../../../workflows/storefront/preset-lookups"

/** A section a look's full apply would leave out in this shop, for the apply window to list. */
export interface UnfitSection {
  /** `home.kategoriler`: its group and its id in the look. */
  where: string
  type: string
  /** The look's own title for it, when it gives one. */
  title: string | null
  /** Why: the records it names the shop lacks (`category:cakilar`), or its feature off. */
  refs: string[]
  reason: "missing" | "feature_off"
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/** The look's sections by where the walk names them (`home.kategoriler`). */
function sectionsByWhere(layout: Record<string, readonly unknown[] | undefined>) {
  const found = new Map<string, Record<string, unknown>>()
  for (const group of PRESET_GROUPS) {
    for (const section of layout[group] ?? []) {
      if (isObject(section) && typeof section["id"] === "string") {
        found.set(`${group}.${section["id"]}`, section)
      }
    }
  }
  return found
}

/**
 * What a look's full apply would leave out of the header, home, footer,
 * product and category groups in this shop (owner's decision 2026-11-28),
 * read before it is applied: the same lookups and walk the apply runs
 * (`resolvePresetStep`), with its images stood in for (an image never
 * drops a section) and its content pages left aside (the apply opens
 * those as drafts). A section bound to a category or product the shop
 * lacks, or whose feature is off here, is named with the references that
 * took it. Reads only; null for a look this build does not have.
 */
export async function presetFit(
  container: MedusaContainer,
  pack: string,
  code: string
): Promise<UnfitSection[] | null> {
  let preset
  try {
    preset = storefrontPreset(pack, code)
  } catch (error) {
    if (error instanceof SectorPackError) {
      return null
    }
    throw error
  }
  if (!preset) {
    return null
  }
  const layout = { ...preset.layout, pages: [] }
  const markers = presetMarkers({ layout })
  const images = new Map([...markers.images].map((path) => [path, `/${path}`]))
  const [lookups, off] = await Promise.all([
    presetLookups(container, markers, images),
    sectionTypesOff(container),
  ])
  const resolved = resolvePreset(layout, null, { ...lookups, types_off: off })
  const sections = sectionsByWhere(preset.layout)
  const why = new Map<string, SkippedRef[]>()
  for (const each of resolved.skipped) {
    why.set(each.where, [...(why.get(each.where) ?? []), each])
  }
  return resolved.dropped.flatMap((where) => {
    const section = sections.get(where)
    if (!section) {
      return []
    }
    const skipped = why.get(where) ?? []
    const featureOff = skipped.some((each) => each.reason === "feature_off")
    return [
      {
        where,
        type: str(section["type"]) ?? "?",
        title: str(section["title"]),
        refs: [...new Set(skipped.map((each) => each.ref))],
        reason: featureOff ? ("feature_off" as const) : ("missing" as const),
      },
    ]
  })
}
