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
  }
}

/** The pack a shop with none on its record is set up with. */
export const DEFAULT_SECTOR_PACK = "general"

export const SECTOR_PACK_COUNTS = [
  "attribute_templates",
  "attributes",
  "categories",
  "flags",
  "seo_templates",
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
