import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { FREE_SHIPPING_CLASS } from "../../modules/platform-settings/sections/shipping"
import type { ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * A product's shipping class as saved (adr/0087 §1): the built-in `free`,
 * or a class the shop has now (Settings > Shipping). Null (Standard) is
 * always one. A class removed later is read as Standard, never refused.
 */
export async function assertKnownShippingClass(
  container: Pick<MedusaContainer, "resolve">,
  key: string | null | undefined
): Promise<void> {
  if (key === null || key === undefined || key === FREE_SHIPPING_CLASS) {
    return
  }
  const shipping = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("shipping")) as unknown as ShippingSettings
  if (!shipping.shipping_classes.some((each) => each.key === key)) {
    throw new ValidationError("shipping.class_unknown", { field: "shipping_class" })
  }
}
