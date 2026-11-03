import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ProductCatalogExtensionLink from "../../links/product-catalog-extension"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"

export { giftLineIdsOf, giftProductsAmong } from "./gift-marks"

type Container = Pick<MedusaContainer, "resolve">

/** Every product marked as a gift card: a shop has few, so the sweep reads them whole. */
export async function allGiftProducts(container: Container): Promise<Set<string>> {
  const extensions = await container
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listProductExtensions({ is_gift_card: true }, { select: ["id"], take: null })
  if (extensions.length === 0) {
    return new Set()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: ProductCatalogExtensionLink.entryPoint,
    fields: ["product_id"],
    filters: { product_extension_id: extensions.map((row) => row.id) },
  })
  return new Set(
    (data as { product_id?: string | null }[]).flatMap((link) =>
      link.product_id ? [link.product_id] : []
    )
  )
}
