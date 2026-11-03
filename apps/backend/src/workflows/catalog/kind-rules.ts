import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { GIFT_CARDS, NON_PHYSICAL_PRODUCTS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { shippingChanges } from "./shipping-kind"
import type { ProductKind, ShippingChanges, ShippingRow } from "./shipping-kind"
import type { ExtensionFields, SetProductCatalogInput } from "./steps/plan-product-catalog"

/** A catalog save's kind (F3.2) and gift card mark (adr/0025 Ek 2026-11-03) rules. */

/**
 * A kind change (F3.2): digital and service need the flag (a product that
 * already is one may stay so), and shipping follows the kind. Saving the
 * same kind again re-aligns profile and items too.
 */
export async function kindShipping(
  container: MedusaContainer,
  product: ShippingRow,
  kind: ProductKind,
  current: ProductKind,
  giftCard: boolean
): Promise<ShippingChanges> {
  // A gift card is digital under its own flag (checked when it is marked)
  if (kind !== "physical" && kind !== current && !giftCard) {
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await settings.isFeatureEnabled(NON_PHYSICAL_PRODUCTS))) {
      throw new ValidationError("catalog.kind_disabled", { field: "kind" })
    }
  }
  let defaultProfile: string | null = null
  if (kind === "physical" && !product.shipping_profile?.id) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "shipping_profile",
      fields: ["id", "type"],
      filters: {},
    })
    const profiles = data as { id: string; type: string }[]
    defaultProfile =
      (profiles.find((profile) => profile.type === "default") ?? profiles[0])?.id ?? null
  }
  return shippingChanges(product, kind, defaultProfile)
}

/**
 * A gift card product (adr/0025 Ek 2026-11-03): marking one needs the shop's
 * gift cards on (unmarking never does); it is digital, another kind refused
 * while it is one. The kind the save writes, or undefined to keep it.
 */
export async function giftCardKind(
  container: MedusaContainer,
  input: SetProductCatalogInput,
  current: ExtensionFields | null
): Promise<ProductKind | undefined> {
  const marking = input.is_gift_card === true && current?.is_gift_card !== true
  if (marking) {
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await settings.isFeatureEnabled(GIFT_CARDS))) {
      throw new ValidationError("catalog.gift_card_disabled", { field: "is_gift_card" })
    }
  }
  if (!(input.is_gift_card ?? current?.is_gift_card ?? false)) {
    return input.kind
  }
  if (input.kind !== undefined && input.kind !== "digital") {
    throw new ValidationError("catalog.gift_card_kind", { field: "kind" })
  }
  return input.is_gift_card === true ? "digital" : input.kind
}
