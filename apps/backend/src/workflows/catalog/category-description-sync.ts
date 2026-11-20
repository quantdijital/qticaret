import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { currentListingDoc } from "../../lib/catalog/listing-description"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { categoryDescriptionLockKey, categoryOf } from "./category-description"

type Container = Pick<MedusaContainer, "resolve">

const catalog = (container: Container) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

/**
 * A category's text changed outside its document (adr/0075): Medusa's own
 * `POST /admin/product-categories/:id`, an import, a script. The stored
 * document no longer tells the text, so it goes and the plain text is the
 * category's text again, as a brand's or a collection's plain-text save
 * drops theirs. Our own save writes the document and its text together
 * under the same lock, so it always reads as current here and stays.
 * Reads hide a stale document already (`currentListingDoc`); this clears
 * the row. Returns whether a document was dropped.
 */
export async function dropStaleCategoryDoc(
  container: Container,
  categoryId: string
): Promise<boolean> {
  return container.resolve(Modules.LOCKING).execute(
    categoryDescriptionLockKey(categoryId),
    async () => {
      const service = catalog(container)
      const [row] = await service.listCategoryExtensions(
        { category_id: categoryId },
        { select: ["id", "description_doc"], take: 1 }
      )
      if (!row?.description_doc) {
        return false
      }
      const category = await categoryOf(container, categoryId)
      if (!category) {
        return false
      }
      if (currentListingDoc(row.description_doc, category.description ?? "") !== null) {
        return false
      }
      await service.updateCategoryExtensions({ id: row.id, description_doc: null })
      return true
    },
    { timeout: 10 }
  )
}

/** A deleted category's description row goes with it: nothing reads it again. */
export async function deleteCategoryExtension(
  container: Container,
  categoryId: string
): Promise<void> {
  const service = catalog(container)
  const rows = await service.listCategoryExtensions({ category_id: categoryId }, { select: ["id"] })
  if (rows.length > 0) {
    await service.deleteCategoryExtensions(rows.map((row) => row.id))
  }
}
