import type { IProductModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { planVariantImageTies, readVariantImages } from "../../lib/catalog/variant-images"
import type { CreatedProductShape, VariantImageTie } from "../../lib/catalog/variant-images"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The variant pictures a new product was sent with
 * (`additional_data.variant_images`), as ties by id: read and checked
 * before anything is written. One product per request, as the panel's
 * create sends; none asked for, none planned.
 */
export async function planCreatedVariantImages(
  container: Container,
  productIds: readonly string[],
  additional: unknown
): Promise<VariantImageTie[]> {
  const wanted = readVariantImages(additional)
  if (wanted.length === 0) {
    return []
  }
  if (productIds.length !== 1) {
    throw new ValidationError("catalog.variant_images_invalid", {
      field: "additional_data.variant_images",
    })
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "images.id",
      "images.url",
      "options.id",
      "options.title",
      "variants.id",
      "variants.options.value",
      "variants.options.option_id",
    ],
    filters: { id: productIds[0] ?? "" },
  })
  const product: CreatedProductShape = data[0] ?? {}
  return planVariantImageTies(product, wanted)
}

/** Medusa's variant images (the product module's own pivot), written in one call. */
export async function tieImages(container: Container, ties: VariantImageTie[]): Promise<void> {
  if (ties.length > 0) {
    await container.resolve<IProductModuleService>(Modules.PRODUCT).addImageToVariant(ties)
  }
}

/** The ties above taken back, when the product's creation is undone. */
export async function untieImages(container: Container, ties: VariantImageTie[]): Promise<void> {
  if (ties.length > 0) {
    await container.resolve<IProductModuleService>(Modules.PRODUCT).removeImageFromVariant(ties)
  }
}
