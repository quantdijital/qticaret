import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { vatNamesByType } from "../../../lib/catalog-sheet"
import type { SheetUnits } from "../../../lib/catalog-sheet"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { findVatRegion } from "../../tax/region"
import { vatStateOf } from "../../tax/vat-state"
import type { VatNames } from "./rows"

export interface SheetContext {
  units: SheetUnits
  /** Every template's product attributes, by key: one column each. */
  attributeKeys: string[]
  /** Where stock is read and written: the shop's default warehouse. */
  locationId: string | null
  /** The KDV rates' names by product type, the default's for the rest (adr/0007). */
  vatNames: VatNames
}

async function vatNamesOf(container: MedusaContainer): Promise<VatNames> {
  const region = await findVatRegion(container)
  return region
    ? vatNamesByType((await vatStateOf(container, region.id)).rates)
    : { byType: new Map(), fallback: null }
}

/** What the template and the export are shaped by: the shop's units, attributes, warehouse and KDV rates. */
export async function sheetContext(container: MedusaContainer): Promise<SheetContext> {
  const [settings, definitions, { data: stores }, vatNames] = await Promise.all([
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE).getSection("store"),
    container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeDefinitions({ scope: "product" }, { select: ["key"] }),
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["default_location_id"] }),
    vatNamesOf(container),
  ])
  const store = settings as unknown as StoreSettings
  return {
    units: { weight: store.weight_unit, dimension: store.dimension_unit },
    attributeKeys: [...new Set(definitions.map((definition) => definition.key))].sort(),
    locationId:
      (stores[0] as { default_location_id?: string | null } | undefined)?.default_location_id ??
      null,
    vatNames,
  }
}
