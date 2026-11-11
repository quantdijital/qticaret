import type { TFunction } from "i18next"
import { SECTOR_PACK_COUNTS } from "./api"
import type { SectorPackSummary } from "./api"

/** What a pack brings, in short: "2 özellik şablonu · 31 özellik · 16 önerilen kategori". */
export function packContents(t: TFunction, pack: SectorPackSummary): string {
  const parts = SECTOR_PACK_COUNTS.filter((key) => pack.counts[key] > 0).map((key) =>
    t(`sectorPacks.counts.${key}`, { count: pack.counts[key] })
  )
  return parts.length > 0 ? parts.join(" · ") : t("sectorPacks.empty")
}
