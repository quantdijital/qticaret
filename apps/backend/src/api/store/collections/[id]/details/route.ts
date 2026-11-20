import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { listingDescriptionHtml } from "../../../../../lib/catalog/listing-description"
import { MEDIA_MODULE } from "../../../../../modules/media"
import type MediaModuleService from "../../../../../modules/media/service"
import {
  COLLECTION_EXTENSION_FIELDS,
  isCollectionShown,
} from "../../../../../workflows/catalog/collection-fields"
import type { CollectionExtensionRow } from "../../../../../workflows/catalog/collection-fields"

/**
 * GET /store/collections/:id/details: what a collection's page shows
 * above its products beyond Medusa's title: its intro and its picture,
 * with the size and versions the media library knows. A hidden
 * collection is not found, as its page is not. The same for everyone;
 * kept a minute.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: ["id", ...COLLECTION_EXTENSION_FIELDS],
    filters: { id: req.params["id"] ?? "" },
  })
  const row = data[0] as { collection_extension?: CollectionExtensionRow | null } | undefined
  if (!row || !isCollectionShown(row)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.collection_unknown")
  }
  const own = row.collection_extension ?? null
  const url = own?.image_url ?? null
  const [asset] = url
    ? await req.scope
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ url }, { select: ["width", "height", "derivatives"], take: 1 })
    : []
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({
    details: {
      description: own?.description ?? null,
      // adr/0075: its document as HTML for the foot of its page; null: plain text only
      description_html: listingDescriptionHtml(own?.description_doc),
      image: url
        ? {
            url,
            alt: own?.image_alt ?? null,
            width: asset?.width ?? null,
            height: asset?.height ?? null,
            derivatives: asset?.derivatives ?? null,
          }
        : null,
    },
  })
}
