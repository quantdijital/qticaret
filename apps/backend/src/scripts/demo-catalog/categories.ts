import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { setCategoryImageWorkflow } from "../../workflows/catalog/category-images"
import { deriveLibraryMediaWorkflow } from "../../workflows/media/workflows"
import { uploadDemoImage } from "./images"
import type { DemoCatalog } from "./schema"

export interface Ensured {
  ids: Map<string, string>
  created: number
}

interface CategoryRow {
  id: string
  handle: string
  is_active: boolean
}

/**
 * The file's categories in its order (a parent before its children): one
 * missing is made, shown and marked; one already here (the shop's, a
 * sector pack's hidden one) is only shown. A category without a picture
 * gets the file's, from the media library with its versions.
 */
export async function ensureCategories(
  container: MedusaContainer,
  catalog: DemoCatalog,
  imageDir: string
): Promise<Ensured & { images: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "is_active"],
    filters: { handle: catalog.categories.map((category) => category.handle) },
  })
  const rows = new Map((data as unknown as CategoryRow[]).map((row) => [row.handle, row]))
  const ids = new Map<string, string>()
  let created = 0
  let images = 0
  const pictures = container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

  for (const category of catalog.categories) {
    const parentId = category.parent ? ids.get(category.parent) : undefined
    if (category.parent && !parentId) {
      throw new Error(`demo-catalog: ${category.handle} comes before its parent ${category.parent}`)
    }
    const existing = rows.get(category.handle)
    let id = existing?.id
    if (!existing) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            {
              name: category.name,
              handle: category.handle,
              is_active: true,
              metadata: { demo: true, demo_catalog: catalog.name },
              ...(parentId ? { parent_category_id: parentId } : {}),
              ...(category.description ? { description: category.description } : {}),
            },
          ],
        },
      })
      id = result[0]?.id
      created += 1
    } else if (!existing.is_active) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: existing.id }, update: { is_active: true } },
      })
    }
    if (!id) {
      throw new Error(`demo-catalog: category ${category.handle} was not made`)
    }
    ids.set(category.handle, id)

    if (category.image) {
      const [has] = await pictures.listCategoryImages({ category_id: id }, { take: 1 })
      if (!has) {
        const asset = await uploadDemoImage(
          container,
          { dir: imageDir, file: category.image },
          `kategori-${category.handle}`,
          true
        )
        await deriveLibraryMediaWorkflow(container).run({ input: { ids: [asset.id] } })
        await setCategoryImageWorkflow(container).run({
          input: {
            category_id: id,
            image: { url: asset.url, alt: category.image_alt ?? category.name },
          },
        })
        images += 1
      }
    }
  }
  return { ids, created, images }
}

/**
 * Takes the named products and categories off the storefront: a published
 * product becomes a draft, a shown category hidden. Nothing is deleted, so
 * the panel brings each back with one switch.
 */
export async function hideRecords(
  container: MedusaContainer,
  hide: DemoCatalog["hide"]
): Promise<{ products: number; categories: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = hide.products.length
    ? await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: hide.products, status: "published" },
      })
    : { data: [] }
  for (const product of products) {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: product.id }, update: { status: "draft" } },
    })
  }
  const { data: categories } = hide.categories.length
    ? await query.graph({
        entity: "product_category",
        fields: ["id"],
        filters: { handle: hide.categories, is_active: true },
      })
    : { data: [] }
  for (const category of categories) {
    await updateProductCategoriesWorkflow(container).run({
      input: { selector: { id: category.id }, update: { is_active: false } },
    })
  }
  return { products: products.length, categories: categories.length }
}
