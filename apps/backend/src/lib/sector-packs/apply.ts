import type { MedusaContainer } from "@medusajs/framework/types"
import type { SectorPack } from "@qticaret/sector-packs"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type { OfferedItem } from "../../modules/sector-packs/service"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { logger } from "../logging"
import { applyAttributeTemplates } from "./apply-attributes"
import { applyCategories } from "./apply-catalog"
import { applyFlags, applySeoTemplates } from "./apply-settings"
import { checkedPack } from "./check"

export interface ApplyPackOutcome {
  pack: string
  version: number
  /** Offered now and made. */
  added: number
  /** Offered now; the shop had its own, left as it was. */
  kept: number
  /** Offered now with nothing to hang on (a removed template or parent). */
  skipped: number
}

/**
 * A sector pack applied to this shop (adr/0061 F17.7, C12), checked first
 * with the shop's own schemas (a pack it cannot take changes nothing).
 * Idempotent and additive: every item is offered once, by its stable
 * name, and recorded as it is (`sector_pack_item`); an item recorded
 * before is never offered again, so nothing the shop edited or removed is
 * written over or brought back, and a newer version adds only its new
 * items. Each item is written through the workflow the panel uses for it.
 * Running it twice gives the same shop; the second run offers nothing.
 */
export async function applySectorPack(
  container: MedusaContainer,
  raw: SectorPack
): Promise<ApplyPackOutcome> {
  const pack = checkedPack(raw)
  const ledger = container.resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
  const offered = await ledger.offeredItems(pack.code)
  const counts = { added: 0, kept: 0, skipped: 0 }
  const record = async (item: OfferedItem) => {
    await ledger.recordItem(pack.code, pack.version, item)
    offered.set(item.key, item)
    counts[item.outcome] += 1
  }
  const context = { container, pack, offered, record }
  await applyAttributeTemplates(context)
  await applyCategories(context)
  await applyFlags(context)
  await applySeoTemplates(context)
  await ledger.markApplied(pack.code, pack.version)
  logger.info(
    { event: "sector_pack.applied", pack: pack.code, version: pack.version, ...counts },
    "sector pack applied"
  )
  return { pack: pack.code, version: pack.version, ...counts }
}
