import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InventorySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { STOCK_LEDGER_MODULE } from "../../modules/stock-ledger"
import type StockLedgerModuleService from "../../modules/stock-ledger/service"

export interface Thresholds {
  /** The shop's default (Settings > inventory). */
  fallback: number
  /** An item's own threshold, else the shop's. */
  of: (inventoryItemId: string) => number
}

/** Low-stock thresholds (adr/0020) for these items: their own where set, else the shop's. */
export async function lowStockThresholds(
  container: MedusaContainer,
  inventoryItemIds: readonly string[]
): Promise<Thresholds> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("inventory")) as unknown as InventorySettings
  const fallback = settings.low_stock_threshold
  const watches = inventoryItemIds.length
    ? await container
        .resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
        .listStockWatches(
          { inventory_item_id: [...inventoryItemIds], threshold: { $ne: null } },
          { select: ["inventory_item_id", "threshold"] }
        )
    : []
  const own = new Map(watches.map((watch) => [watch.inventory_item_id, watch.threshold]))
  return { fallback, of: (id) => own.get(id) ?? fallback }
}
