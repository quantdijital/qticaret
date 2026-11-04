import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"

type Container = Pick<MedusaContainer, "resolve">

const catalog = (container: Container) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

export interface CategoryImageInput {
  url: string
  alt: string | null
}

export interface SetCategoryImageInput {
  category_id: string
  /** Null takes the picture off. */
  image: CategoryImageInput | null
}

/** A picture as the storefront shows it: the library's size and versions where it knows them. */
export interface StoreCategoryImage {
  category_id: string
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

/**
 * Sets a category's picture or takes it off (adr/0046 Ek 2026-11-04): the
 * picture must be one of the shop's uploads (the media library's), never
 * an outside address. Undone, the picture before comes back.
 */
const setCategoryImageStep = createStep(
  "catalog-set-category-image",
  async (input: SetCategoryImageInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: input.category_id },
    })
    if (data.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.category_unknown")
    }
    if (input.image) {
      const uploaded = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets(
          { url: input.image.url, file_id: { $ne: null } },
          { select: ["id"], take: 1 }
        )
      if (uploaded.length === 0) {
        throw new ValidationError("catalog.category_image_unknown", { field: "image" })
      }
    }
    const service = catalog(container)
    const [before] = await service.listCategoryImages(
      { category_id: input.category_id },
      { take: 1 }
    )
    if (input.image === null) {
      if (before) {
        await service.deleteCategoryImages([before.id])
      }
    } else if (before) {
      await service.updateCategoryImages({ id: before.id, ...input.image })
    } else {
      await service.createCategoryImages({ category_id: input.category_id, ...input.image })
    }
    return new StepResponse(
      { category_id: input.category_id, image: input.image },
      {
        category_id: input.category_id,
        before: before ? { url: before.url, alt: before.alt } : null,
      }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = catalog(container)
    const [now] = await service.listCategoryImages({ category_id: undo.category_id }, { take: 1 })
    if (now) {
      await service.deleteCategoryImages([now.id])
    }
    if (undo.before) {
      await service.createCategoryImages({ category_id: undo.category_id, ...undo.before })
    }
  }
)

/** A category's picture, set or taken off; the storefront's menus forget theirs. */
export const setCategoryImageWorkflow = createWorkflow(
  "catalog-set-category-image",
  (input: SetCategoryImageInput) => {
    const result = setCategoryImageStep(input)
    refreshStorefrontStep(transform({}, () => ["menus" as const]))
    return new WorkflowResponse(result)
  }
)

interface CategoryRow {
  id: string
  is_active?: boolean | null
  is_internal?: boolean | null
}

/**
 * The pictures of the categories a shopper may see (active, not internal),
 * with what the media library knows of each: its size and its versions.
 */
export async function storeCategoryImages(container: Container): Promise<StoreCategoryImage[]> {
  const rows = await catalog(container).listCategoryImages(
    {},
    { select: ["category_id", "url", "alt"], take: null }
  )
  if (rows.length === 0) {
    return []
  }
  const [{ data: categories }, assets] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_category",
      fields: ["id", "is_active", "is_internal"],
      filters: { id: rows.map((row) => row.category_id) },
    }),
    container
      .resolve<MediaModuleService>(MEDIA_MODULE)
      .listMediaAssets(
        { url: [...new Set(rows.map((row) => row.url))] },
        { select: ["url", "width", "height", "derivatives"] }
      ),
  ])
  const live = new Set(
    (categories as CategoryRow[])
      .filter((category) => category.is_active !== false && category.is_internal !== true)
      .map((category) => category.id)
  )
  const byUrl = new Map(assets.map((asset) => [asset.url, asset]))
  return rows
    .filter((row) => live.has(row.category_id))
    .map((row) => {
      const asset = byUrl.get(row.url)
      return {
        category_id: row.category_id,
        url: row.url,
        alt: row.alt,
        width: asset?.width ?? null,
        height: asset?.height ?? null,
        derivatives: asset?.derivatives ?? null,
      }
    })
}
