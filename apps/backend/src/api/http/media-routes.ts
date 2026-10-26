import { validateAndTransformBody } from "@medusajs/framework/http"
import { AdminPostMedia, AdminPostMediaAlt } from "../admin/media/validators"
import { restrictStoreRelation } from "../validation/attribute-fields"

/** F3.3: product images registered after upload, and their alt text. */
export const MEDIA_ROUTES = [
  {
    matcher: "/admin/media",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostMedia)],
  },
  {
    matcher: "/admin/media/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostMediaAlt)],
  },
]

/**
 * A product's images as the Store API shows them
 * (`fields=+media_assets.url,+media_assets.alt,...`): the master's URL and
 * size, the alt text, and the versions for `srcset` and sharing. Storage
 * keys and bookkeeping stay inside, so the relation's every column
 * (`*media_assets`) is refused.
 */
export const STORE_MEDIA_LEAVES = [
  "media_assets.id",
  "media_assets.url",
  "media_assets.width",
  "media_assets.height",
  "media_assets.alt",
  "media_assets.derivatives",
] as const

// Medusa's allowed list needs the relation named for the leaves to resolve
export const STORE_MEDIA_FIELDS = ["media_assets", ...STORE_MEDIA_LEAVES]

export const restrictStoreMediaFields = restrictStoreRelation(
  /(^|\.)\*?media_assets\b/,
  STORE_MEDIA_LEAVES,
  "media_fields"
)
