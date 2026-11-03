import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { toStoredAddons } from "../../lib/catalog/addons"
import type { AddonInput, StoredAddons } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * The add-ons a catalog save writes (adr/0052), as the product keeps them:
 * new ones get their ids here, ids sent are kept (cart lines name add-ons
 * by them). Saving some needs the shop's flag; clearing them never does.
 * Undefined keeps them.
 */
export async function addonsToWrite(
  container: Pick<MedusaContainer, "resolve">,
  addons: AddonInput[] | null | undefined
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
  return {
    items: toStoredAddons(addons, (prefix) => `${prefix}_${randomBytes(6).toString("hex")}`),
  }
}
