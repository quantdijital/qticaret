import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { aiValidationError } from "../errors"
import { readProductFacts } from "./product"
import type { FactsContainer, RecordFacts } from "./types"

/** The image a vision task reads: by its file in the shop's own storage, never by its address. */
export interface AiImageRef {
  file_id: string
}

export interface MediaFacts {
  fields: RecordFacts
  image: AiImageRef
}

interface MediaRow {
  id: string
  file_id?: string | null
  mime_type?: string | null
  alt?: string | null
  product?: { id: string } | null
}

// What a stored master is when the pipeline took it in (F3.3); SVG is a library logo, never read
const READABLE_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])

/** The media record's fields read; nothing of who uploaded it or its name. */
export const MEDIA_FACT_FIELDS = ["id", "file_id", "mime_type", "alt", "product.id"] as const

/**
 * What may leave the shop for an image's alt text (adr/0071 §10): the
 * picture itself (EXIF and GPS were dropped at upload) and, when a
 * product shows it, the product's name and shown category through the
 * product reader (its public fields alone). The file name, the uploader
 * and the alt text now stay home: a name may carry a person's. An image
 * added by its address only (no stored file) or an SVG cannot be read
 * (`ai.input_unsupported`); no such record is `ai.unknown_entity`.
 */
export async function mediaFacts(container: FactsContainer, id: string): Promise<MediaFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "media_asset",
    fields: [...MEDIA_FACT_FIELDS],
    filters: { id },
  })
  const media = data[0] as MediaRow | undefined
  if (!media) {
    throw aiValidationError("ai.unknown_entity")
  }
  if (!media.file_id || !READABLE_TYPES.has(media.mime_type ?? "")) {
    throw aiValidationError("ai.input_unsupported")
  }
  const product = media.product?.id ? await readProductFacts(container, media.product.id) : null
  return {
    fields: { product: product?.name ?? null, category: product?.category ?? null },
    image: { file_id: media.file_id },
  }
}
