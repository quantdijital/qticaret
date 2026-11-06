import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { libraryVersionBase } from "../../../lib/media"
import type { DeriveTarget } from "./plan-product-media"

interface AssetRow {
  id: string
  file_id: string | null
  filename: string | null
  derivatives: unknown
  product?: { id: string } | null
}

/**
 * The pictures among these that still need their versions: a stored master
 * (one added by its URL alone has none), no versions yet, and no product
 * holding it (a product's run names them after the product, adr/0016).
 */
export async function libraryTargets(
  container: Pick<MedusaContainer, "resolve">,
  ids: readonly string[]
): Promise<DeriveTarget[]> {
  if (ids.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "media_asset",
    fields: ["id", "file_id", "filename", "derivatives", "product.id"],
    filters: { id: [...ids] },
  })
  return (data as AssetRow[]).flatMap((asset) =>
    asset.file_id && !asset.derivatives && !asset.product?.id
      ? [
          {
            assetId: asset.id,
            fileId: asset.file_id,
            derivedFor: null,
            name: libraryVersionBase(asset.filename),
            onlyIfNone: true,
          },
        ]
      : []
  )
}

/** What a library run makes versions for (reads only). */
export const planLibraryMediaStep = createStep(
  "media-plan-library",
  async (ids: string[], { container }) => new StepResponse(await libraryTargets(container, ids))
)
