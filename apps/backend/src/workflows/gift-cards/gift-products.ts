import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ProductCatalogExtensionLink from "../../links/product-catalog-extension"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"

type Container = Pick<MedusaContainer, "resolve">

/** Which of these products are marked as gift cards (adr/0025 Ek 2026-11-03). */
export async function giftProductsAmong(
  container: Container,
  productIds: readonly (string | null | undefined)[]
): Promise<Set<string>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) {
    return new Set()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.is_gift_card"],
    filters: { id: ids },
  })
  return new Set(
    (data as { id: string; product_extension?: { is_gift_card?: boolean | null } | null }[])
      .filter((row) => row.product_extension?.is_gift_card === true)
      .map((row) => row.id)
  )
}

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
