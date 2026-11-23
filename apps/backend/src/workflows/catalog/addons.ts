import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { growsPastLimit, toStoredAddons } from "../../lib/catalog/addons"
import type { AddonInput, StoredAddons } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { addonSourcesAmong } from "../addons/effective"

/**
 * The add-ons a catalog save writes (adr/0052), as the product keeps them:
 * new ones get their ids here, ids sent are kept (cart lines name add-ons
 * by them). Saving some needs the shop's flag; clearing them never does.
 * Undefined keeps them. With the templates the product reaches (adr/0052
 * Ek 2026-11-23), five add-ons in all at most.
 */
export async function addonsToWrite(
  container: Pick<MedusaContainer, "resolve">,
  addons: AddonInput[] | null | undefined,
  productId: string
): Promise<StoredAddons | null | undefined> {
  if (addons === undefined) {
    return undefined
  }
  if (addons === null || addons.length === 0) {
    return null
  }
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(PRODUCT_ADDONS))) {
    throw new ValidationError("catalog.addons_disabled", { field: "addons" })
  }
  const items = toStoredAddons(addons, (prefix) => `${prefix}_${randomBytes(6).toString("hex")}`)
  const sources = (await addonSourcesAmong(container, [productId])).get(productId)
  // One already past five (its attribute template changed) may still shrink
  if (sources) {
    if (growsPastLimit(sources, { ...sources, own: items })) {
      throw new ValidationError("addons.too_many", { field: "addons" })
    }
  }
  return { items }
}
