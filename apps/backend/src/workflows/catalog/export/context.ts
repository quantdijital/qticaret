import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { SheetUnits } from "../../../lib/catalog-sheet"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"

export interface SheetContext {
  units: SheetUnits
  /** Every template's product attributes, by key: one column each. */
  attributeKeys: string[]
  /** Where stock is read and written: the shop's default warehouse. */
  locationId: string | null
}

/** What the template and the export are shaped by: the shop's units, attributes and warehouse. */
export async function sheetContext(container: MedusaContainer): Promise<SheetContext> {
  const [settings, definitions, { data: stores }] = await Promise.all([
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE).getSection("store"),
    container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeDefinitions({ scope: "product" }, { select: ["key"] }),
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["default_location_id"] }),
  ])
  const store = settings as unknown as StoreSettings
  return {
    units: { weight: store.weight_unit, dimension: store.dimension_unit },
    attributeKeys: [...new Set(definitions.map((definition) => definition.key))].sort(),
    locationId:
      (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
      null,
  }
}
