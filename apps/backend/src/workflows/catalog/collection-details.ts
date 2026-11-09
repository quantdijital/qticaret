import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { COLLECTION_EXTENSION_FIELDS } from "./collection-fields"
import type { CollectionExtensionRow } from "./collection-fields"

export interface SetCollectionDetailsInput {
  collection_id: string
  /** Plain paragraphs; null or "" clears it. */
  description?: string | null | undefined
  is_active?: boolean | undefined
  /** A media library image by its address; null takes it off. */
  image?: { url: string; alt: string | null } | null | undefined
}

interface Values {
  description: string | null
  is_active: boolean
  image_url: string | null
  image_alt: string | null
}

interface Plan {
  collection_id: string
  /** The row to change; none: one is made and linked. */
  id: string | null
  set: Partial<Values>
  previous: Values
}

const catalog = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

/**
 * What the save changes: the collection must be there, its picture one
 * of the shop's uploads (the media library's), never an outside address.
 */
const planCollectionDetailsStep = createStep(
  "catalog-plan-collection-details",
  async (input: SetCollectionDetailsInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_collection",
      fields: ["id", ...COLLECTION_EXTENSION_FIELDS],
      filters: { id: input.collection_id },
    })
    const row = data[0] as { collection_extension?: CollectionExtensionRow | null } | undefined
    if (!row) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.collection_unknown")
    }
    if (input.image) {
      const uploaded = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets(
          { url: input.image.url, file_id: { $ne: null } },
          { select: ["id"], take: 1 }
        )
      if (uploaded.length === 0) {
        throw new ValidationError("catalog.collection_image_unknown", { field: "image" })
      }
    }
    const own = row.collection_extension ?? null
    const set: Partial<Values> = {
      ...(input.description !== undefined
        ? { description: input.description?.trim() ? input.description.trim() : null }
        : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.image !== undefined
        ? { image_url: input.image?.url ?? null, image_alt: input.image?.alt ?? null }
        : {}),
    }
    const plan: Plan = {
      collection_id: input.collection_id,
      id: own?.id ?? null,
      set,
      previous: {
        description: own?.description ?? null,
        is_active: own?.is_active ?? true,
        image_url: own?.image_url ?? null,
        image_alt: own?.image_alt ?? null,
      },
    }
    return new StepResponse(plan)
  }
)

type Undo = { kind: "created"; id: string } | { kind: "updated"; id: string; previous: Values }

/** Changes the collection's row or makes one; undone, the row is as it was. */
const writeCollectionDetailsStep = createStep(
  "catalog-write-collection-details",
  async (plan: Plan, { container }) => {
    const service = catalog(container)
    if (plan.id) {
      await service.updateCollectionExtensions({ id: plan.id, ...plan.set })
      return new StepResponse<{ createdId: string | null }, Undo>(
        { createdId: null },
        { kind: "updated", id: plan.id, previous: plan.previous }
      )
    }
    const created = await service.createCollectionExtensions({ ...plan.previous, ...plan.set })
    return new StepResponse<{ createdId: string | null }, Undo>(
      { createdId: created.id },
      { kind: "created", id: created.id }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = catalog(container)
    if (undo.kind === "created") {
      await service.deleteCollectionExtensions(undo.id)
    } else {
      await service.updateCollectionExtensions({ id: undo.id, ...undo.previous })
    }
  }
)

/**
 * Saves a collection's text, picture and visibility (Ürünler >
 * Koleksiyonlar): its first save makes the row and links it, under a
 * lock per collection so two first saves make one. As Medusa's own
 * collection update does, it emits `product-collection.updated` (the
 * advisor assesses the page again); cached path answers are forgotten and
 * the sitemap waits for its refresh; the storefront's menus forget a
 * hidden one.
 */
export const setCollectionDetailsWorkflow = createWorkflow(
  "catalog-set-collection-details",
  (input: SetCollectionDetailsInput) => {
    const lockKey = transform({ input }, ({ input }) => `catalog:collection:${input.collection_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })

    const plan = planCollectionDetailsStep(input)
    const written = writeCollectionDetailsStep(plan)
    const links = transform({ input, written }, ({ input, written }) =>
      written.createdId
        ? [
            {
              [Modules.PRODUCT]: { product_collection_id: input.collection_id },
              [CATALOG_EXTENSION_MODULE]: { collection_extension_id: written.createdId },
            },
          ]
        : []
    )
    createRemoteLinkStep(links)
    // A hidden page answers 404 at once, not after the subscriber's turn
    forgetResolutionsStep()
    const event = transform({ input }, ({ input }) => ({ id: input.collection_id }))
    emitEventStep({ eventName: "product-collection.updated", data: event })
    refreshStorefrontStep(transform({}, () => ["menus" as const]))

    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(undefined)
  }
)
