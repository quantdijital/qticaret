import { Modules, ProductEvents } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { deleteCollectionsWorkflow } from "@medusajs/medusa/core-flows"

interface Unlinked {
  id: string
  collection_id: string
}

/**
 * A deleted collection's products stay, out of it: Medusa soft-deletes the
 * collection and would leave its products pointing at it. Their
 * `product.updated` tells the search index (adr/0056), which lists a
 * collection's products by it. The page's path is kept for its 410
 * (subscribers/catalog-paths-released.ts); its text and picture go with
 * it through the link. Undone, the products are back in it.
 */
deleteCollectionsWorkflow.hooks.collectionsDeleted(
  async ({ ids }, { container }) => {
    const collectionIds = (ids as string[] | undefined) ?? []
    if (collectionIds.length === 0) {
      return new StepResponse(undefined, [] as Unlinked[])
    }
    const products = container.resolve(Modules.PRODUCT)
    const listed = await products.listProducts(
      { collection_id: collectionIds },
      { select: ["id", "collection_id"], take: null }
    )
    const unlinked = listed.flatMap((product): Unlinked[] =>
      product.collection_id ? [{ id: product.id, collection_id: product.collection_id }] : []
    )
    if (unlinked.length === 0) {
      return new StepResponse(undefined, unlinked)
    }
    await products.updateProducts(
      { id: unlinked.map((product) => product.id) },
      { collection_id: null }
    )
    await container.resolve(Modules.EVENT_BUS).emit(
      unlinked.map((product) => ({
        name: ProductEvents.PRODUCT_UPDATED,
        data: { id: product.id },
      }))
    )
    return new StepResponse(undefined, unlinked)
  },
  async (unlinked, { container }) => {
    if (!unlinked || unlinked.length === 0) {
      return
    }
    const products = container.resolve(Modules.PRODUCT)
    const byCollection = new Map<string, string[]>()
    for (const product of unlinked) {
      byCollection.set(product.collection_id, [
        ...(byCollection.get(product.collection_id) ?? []),
        product.id,
      ])
    }
    for (const [collectionId, productIds] of byCollection) {
      await products.updateProducts({ id: productIds }, { collection_id: collectionId })
    }
  }
)
