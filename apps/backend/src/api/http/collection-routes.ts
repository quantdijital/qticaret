import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetCollectionBoard } from "../admin/collection-board/validators"
import { AdminPostCollectionDetails } from "../admin/collections/[id]/details/validators"
import { CATALOG_COLLECTIONS } from "../../modules/platform-settings/features"
import { requireFeature, requireFeatureForWrites } from "./require-feature"

/**
 * `catalog.collections` off: the admin's collection writes (Medusa's
 * create, update, delete and products, and the details) answer as missing
 * routes; reads stay, so the kept records can still be seen. The Store
 * API's collections answer as missing, their pages are not found. Without
 * `methods`, so they run before the core routes' validators and the
 * handle filler; registered ahead of both.
 */
export const COLLECTION_GATES = [
  { matcher: "/admin/collections", middlewares: [requireFeatureForWrites(CATALOG_COLLECTIONS)] },
  { matcher: "/store/collections", middlewares: [requireFeature(CATALOG_COLLECTIONS)] },
]

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
    // adr/0075: a long document is past Express's 100 kB default; its own bounds stay
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminPostCollectionDetails)],
  },
]
