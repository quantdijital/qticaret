import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminDeleteMediaBatch,
  AdminGetMedia,
  AdminGetMediaAsset,
  AdminImportMedia,
  AdminPostMedia,
  AdminUpdateMedia,
} from "../admin/media/validators"
import { requireUserActor } from "./actor"
import { guardImportStorage } from "./plan-limit-guards"
import { rateLimit } from "./rate-limit"
import { restrictStoreRelation } from "../validation/attribute-fields"

// One image by its id; `import` and `delete` are routes of their own, not ids
const MEDIA_ENTRY = /^\/admin\/media\/(?!(?:import|delete)$)[^/]+$/

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
      // adr/0061 Ek C14: a library at the package's storage limit fetches nothing more
      guardImportStorage,
    ],
  },
  // M1: pictures nothing shows, deleted at once (people only; checked again on the server)
  {
    matcher: "/admin/media/delete",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminDeleteMediaBatch)],
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

/**
 * Which variants each picture shows with (Medusa's variant images,
 * `fields=+images.variants.id`): the storefront brings a chosen variant's
 * own pictures to the front of the gallery (owner 2026-11-05). The
 * variants' ids only, which the answer gives anyway.
 */
export const STORE_VARIANT_IMAGE_FIELDS = ["images.variants", "images.variants.id"]

/**
 * A product's videos through `fields` (adr/0069 §6, security review D3):
 * the storefront names its leaves one by one, on the product itself only
 * (what the gallery draws: the outputs' and the poster's public addresses,
 * sizes and versions); the admin API only what the panel's own list
 * shows. Storage keys, file ids, the uploader, the error and the job's
 * bookkeeping never leave, whatever the role or the flag. Matched anywhere
 * in a token (`items.product.media_videos...` too).
 */
export const STORE_VIDEO_LEAVES = [
  "media_videos.id",
  "media_videos.kind",
  "media_videos.status",
  "media_videos.title",
  "media_videos.position",
  "media_videos.width",
  "media_videos.height",
  "media_videos.duration_ms",
  "media_videos.outputs",
  "media_videos.poster",
  "media_videos.youtube_id",
] as const

// Medusa's allowed list needs the relation named for the leaves to resolve
export const STORE_VIDEO_FIELDS = ["media_videos", ...STORE_VIDEO_LEAVES]

export const ADMIN_VIDEO_LEAVES = [
  "media_videos.id",
  "media_videos.kind",
  "media_videos.status",
  "media_videos.title",
  "media_videos.position",
  "media_videos.width",
  "media_videos.height",
  "media_videos.duration_ms",
  "media_videos.source_format",
  "media_videos.source_bytes",
  "media_videos.stored_bytes",
  "media_videos.outputs",
  "media_videos.poster",
  "media_videos.youtube_id",
  "media_videos.error_code",
  "media_videos.created_at",
] as const

const VIDEO_RELATION = /media_video/i

export const restrictStoreVideoFields = restrictStoreRelation(
  VIDEO_RELATION,
  STORE_VIDEO_LEAVES,
  "media_video_fields"
)

export const restrictAdminVideoFields = restrictStoreRelation(
  VIDEO_RELATION,
  ADMIN_VIDEO_LEAVES,
  "media_video_fields"
)

export const restrictStoreMediaFields = restrictStoreRelation(
  /(^|\.)\*?media_assets\b/,
  STORE_MEDIA_LEAVES,
  "media_fields"
)
