import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetCollectionBoard } from "../admin/collection-board/validators"
import { AdminPostCollectionDetails } from "../admin/collections/[id]/details/validators"

/**
 * Ürünler > Koleksiyonlar: the panel's list and a collection's text,
 * picture and visibility. Title, handle, products and deletion are
 * Medusa's collection routes (their hooks claim and release the page's
 * path). Writes are for the owner and admins, as categories' are (adr/0040).
 */
export const COLLECTION_ROUTES = [
  {
    matcher: "/admin/collection-board",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetCollectionBoard, {})],
  },
  {
    matcher: "/admin/collections/:id/details",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostCollectionDetails)],
  },
]
