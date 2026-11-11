import { isSectorPackCode, sectorPacks, summaryOf } from "@qticaret/sector-packs"
import type { SectorPackSummary } from "@qticaret/sector-packs"

/**
 * The sector packs a shop can be set up with (adr/0061 §8 F17.7, C12):
 * whatever `packages/sector-packs/packs/` holds, read from there; the
 * control plane knows a pack by its code and shows its manifest, nothing
 * more. The shop's own build applies it (`tenant:apply-pack`), checked
 * with the shop's schemas. Code never branches on a pack's name.
 */

/** The pack a shop with none on its record is set up with (C11's default). */
export const DEFAULT_SECTOR_PACK = "general"

export const isKnownSectorPack = (code: string): boolean => isSectorPackCode(code)

/** Every pack as the wizard shows it, the general one first. */
export function sectorPackSummaries(): SectorPackSummary[] {
  return sectorPacks()
    .map(summaryOf)
    .sort(
      (a, b) =>
        Number(b.code === DEFAULT_SECTOR_PACK) - Number(a.code === DEFAULT_SECTOR_PACK) ||
        a.name.localeCompare(b.name, "tr")
    )
}

/** The pack a shop applies: its record's, else the general one. */
export const sectorPackOf = (tenant: { sector_pack: string | null }): string =>
  tenant.sector_pack ?? DEFAULT_SECTOR_PACK
