import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetMedia,
  AdminGetMediaAsset,
  AdminImportMedia,
  AdminPostMedia,
  AdminUpdateMedia,
} from "../admin/media/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { restrictStoreRelation } from "../validation/attribute-fields"

// One image by its id; `import` is a route of its own, not an id
const MEDIA_ENTRY = /^\/admin\/media\/(?!import$)[^/]+$/

/**
 * F3.3: images registered after upload, and their alt text. The media
 * library (docs/06): its list, an image's detail, rename and delete, and
 * an outside address brought in (people only, a budget of its own: each
 * fetches from the internet).
 */
export const MEDIA_ROUTES = [
  {
    matcher: "/admin/media",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMedia, {})],
  },
  {
    matcher: "/admin/media",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostMedia)],
  },
  {
    matcher: "/admin/media/import",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.media_import),
      validateAndTransformBody(AdminImportMedia),
    ],
  },
  {
    matcher: MEDIA_ENTRY,
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMediaAsset, {})],
  },
  {
    matcher: MEDIA_ENTRY,
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminUpdateMedia)],
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
