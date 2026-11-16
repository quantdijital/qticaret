import { model } from "@medusajs/framework/utils"

/**
 * A product's video (adr/0069 §1): a clip the shop uploaded, made fit for
 * the web by a background job, or a YouTube video by its id. Linked to its
 * product (`links/product-media-video.ts`: many per product, at most two,
 * one product per video).
 *
 * A clip's life: `uploaded` (its source file, private, waits for the job)
 * → `processing` → `ready` (MP4 + WebM and a poster, public; the source is
 * gone) or `failed` (`error_code`; the source kept a week for a retry). A
 * YouTube video opens `ready`. `stored_bytes` is every file it holds in
 * storage at the moment: what the package's storage limit counts.
 */
export const MediaVideo = model
  .define("media_video", {
    id: model.id({ prefix: "mvid" }).primaryKey(),
    kind: model.enum(["upload", "youtube"]),
    status: model.enum(["uploaded", "processing", "ready", "failed"]).default("uploaded"),
    // The upload as sent, private; removed once the outputs are made
    source_file_id: model.text().nullable(),
    source_bytes: model.number().nullable(),
    // What the bytes are (never the name or MIME type it came with)
    source_format: model.enum(["mp4", "mov", "webm", "gif"]).nullable(),
    // The 11-character id only; the address the shop pasted is not kept
    youtube_id: model.text().nullable(),
    // The player's accessible name and JSON-LD `name`; empty: the product's name
    title: model.text().nullable(),
    // Its place in the gallery: after this many pictures (today always 1)
    position: model.number().default(1),
    width: model.number().nullable(),
    height: model.number().nullable(),
    duration_ms: model.number().nullable(),
    // { mp4: { url, bytes }, webm: { url, bytes } }
    outputs: model.json().nullable(),
    output_file_ids: model.array().nullable(),
    // { url, width, height, derivatives } (derivatives as the images' MediaDerivatives)
    poster: model.json().nullable(),
    poster_file_ids: model.array().nullable(),
    stored_bytes: model.number().default(0),
    // An i18n key (`video.processing_failed`)
    error_code: model.text().nullable(),
    attempts: model.number().default(0),
    // The job's sign of life while `processing` (adr/0069 §4)
    heartbeat_at: model.dateTime().nullable(),
    processed_at: model.dateTime().nullable(),
    // The staff member who added it (a user id)
    uploaded_by: model.text().nullable(),
  })
  .indexes([
    // The job's queue: the oldest waiting first
    { on: ["status", "created_at"], where: "deleted_at IS NULL" },
  ])
