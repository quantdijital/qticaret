import { isSectorPackCode, sectorPack, sectorPacks, summaryOf } from "@qticaret/sector-packs"
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

/**
 * A ready-made look as the wizard's "Görünüm" step shows it (adr/0063
 * §7, task 2.7): its code, the pack's Turkish name and description, its
 * tone, and whether the control plane can show its picture
 * (`GET /admin/cp/sector-packs/:pack/presets/:code/preview`).
 */
export interface PresetSummary {
  code: string
  version: number
  name: string
  description: string
  tone: "light" | "dark"
  preview: boolean
}

export interface SectorPackOffer extends SectorPackSummary {
  /** Its looks in the loader's order; the first is the wizard's default. */
  presets: PresetSummary[]
  /**
   * How many products its sample catalogue holds (`samples/`); 0 for none.
   * The wizard offers "Örnek ürünlerle başla" only when there are some.
   */
  sample_products: number
}

/** The number of products in a pack's sample catalogue; 0 for none or an unknown pack. */
export const sampleProductsOf = (pack: string): number =>
  sectorPack(pack)?.samples?.products.length ?? 0

/** A pack's looks, in the loader's order (by code); none for an unknown pack. */
export function presetsOf(pack: string): PresetSummary[] {
  return (sectorPack(pack)?.presets ?? []).map((preset) => ({
    code: preset.code,
    version: preset.version,
    name: preset.name,
    description: preset.description,
    tone: preset.tone,
    preview: preset.preview !== null,
  }))
}

/** Whether this pack has a look of this code (a shop is set up only with its own pack's). */
export const isPresetOf = (pack: string, code: string): boolean =>
  presetsOf(pack).some((preset) => preset.code === code)

/** The look a shop of this pack gets unless another is chosen: its first; null when it has none. */
export const defaultPresetOf = (pack: string): string | null => presetsOf(pack)[0]?.code ?? null

/** Every pack as the wizard shows it, the general one first, each with its looks. */
export function sectorPackSummaries(): SectorPackOffer[] {
  return sectorPacks()
    .map((pack) => ({
      ...summaryOf(pack),
      presets: presetsOf(pack.code),
      sample_products: sampleProductsOf(pack.code),
    }))
    .sort(
      (a, b) =>
        Number(b.code === DEFAULT_SECTOR_PACK) - Number(a.code === DEFAULT_SECTOR_PACK) ||
        a.name.localeCompare(b.name, "tr")
    )
}

/** The pack a shop applies: its record's, else the general one. */
export const sectorPackOf = (tenant: { sector_pack: string | null }): string =>
  tenant.sector_pack ?? DEFAULT_SECTOR_PACK
