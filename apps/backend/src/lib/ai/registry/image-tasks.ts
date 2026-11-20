import type { AiTask } from "./tasks"
import { AI_TEMPERATURE } from "./catalog-tasks"

// The picture tasks: alt text, background, scene and the product card from a photo

/**
 * The longest alt text suggested: what a screen reader reads in one go
 * (docs/13 §8). The field itself takes up to `ALT_MAX` (250); the
 * advisor's rule (P-IMG-02) asks only that there is one.
 */
export const IMAGE_ALT_MAX_LENGTH = 125

/** Images one bulk alt text job asks for at most (`ai.alt_text`, docs/22 "Aşama 5"). */
export const IMAGE_ALT_BULK_MAX = 50

/**
 * An image's alt text (Aşama 5, docs/22): the service sees the picture
 * and, when a product shows it, the product's name and category. One line
 * of plain text; the gate refuses filler ("görseli", "fotoğrafı"), a
 * link, personal data and markup. Asked for one image here, for many by
 * the bulk job; either way it is a suggestion, saved only by the form.
 */
export const IMAGE_ALT_TEXT_TASK: AiTask = {
  id: "image_alt_text",
  capability: "vision",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image_alt",
  maxLength: IMAGE_ALT_MAX_LENGTH,
  entities: ["media"],
  temperature: AI_TEMPERATURE.factual,
}

/** The most pictures one background request may name (adr/0071 §8: each its own call and claim). */
export const IMAGE_BACKGROUND_MAX_BATCH = 20

/**
 * A picture's background taken away or made white (Aşama 4, docs/22 PR 4-1):
 * a new picture beside the original, marked as AI edited; the original's
 * bytes are never changed. A job (`ai.image_edit`), one to twenty pictures.
 */
export const IMAGE_BACKGROUND_TASK: AiTask = {
  id: "image_background",
  capability: "image_edit",
  mode: "job",
  options: ["transparent", "white"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image",
  maxLength: 0,
  entities: ["media"],
  maxBatch: IMAGE_BACKGROUND_MAX_BATCH,
}

/** The most pictures one scene request may name: a dearer call, asked for one at a time. */
export const IMAGE_SCENE_MAX_BATCH = 1

/**
 * A product photo set in a ready-made scene (Aşama 7, docs/22): a new
 * picture beside the original, marked as AI made (`edited` or `generated`,
 * as the service's scene endpoint is recorded); the original's bytes are
 * never changed. The scenes are the shop's own saved ones (twelve at
 * most) and its sector pack's (two at most), or one typed for this once;
 * a typed one is held (`lib/ai/scene-text.ts`) and sent only behind the
 * server's fixed words. A job (`ai.image_edit`), like the background.
 */
export const IMAGE_SCENE_TASK: AiTask = {
  id: "image_scene",
  capability: "image_edit",
  mode: "job",
  options: [],
  optionSource: "scenes",
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image",
  maxLength: 0,
  entities: ["media"],
  maxBatch: IMAGE_SCENE_MAX_BATCH,
}

/** The longest answer read for a product card, in characters: its JSON, all fields together. */
export const PRODUCT_CARD_MAX_LENGTH = 4_000

/**
 * A new product's card from one photo (Aşama 6, docs/22): its name, a
 * short description, one of the shop's shown categories and values for
 * the chosen template's attributes, as one JSON object read against a
 * closed schema and the shop's own lists (lib/ai/product-card.ts). No
 * price, stock, status or code is asked for or taken. Nothing is saved:
 * the result fills the new product form.
 */
export const PRODUCT_FROM_PHOTO_TASK: AiTask = {
  id: "product_from_photo",
  capability: "vision",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_card",
  maxLength: PRODUCT_CARD_MAX_LENGTH,
  entities: ["media"],
  json: true,
  temperature: AI_TEMPERATURE.structured,
}
