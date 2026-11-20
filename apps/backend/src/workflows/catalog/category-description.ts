import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  releaseLockStep,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import type { DescriptionDoc } from "../../lib/catalog/description"
import { currentListingDoc, listingDescriptionChanges } from "../../lib/catalog/listing-description"
import type { ContentDoc } from "../../lib/content"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"

type Container = Pick<MedusaContainer, "resolve">

/** The lock a category's description is written under, by the save and the stale-document drop. */
export const categoryDescriptionLockKey = (categoryId: string) => `catalog:category:${categoryId}`

const catalog = (container: Container) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

export interface SetCategoryDescriptionInput {
  category_id: string
  /** A checked document; one without text clears the text, null drops the document and keeps it. */
  description_doc: ContentDoc | null
}

/** A category's text as the panel opens it (adr/0075). */
export interface CategoryDescription {
  category_id: string
  /** Medusa's plain text: with a document, its text. */
  description: string
  /** Null: plain text only (the editor opens its paragraphs). */
  description_doc: ContentDoc | null
}

interface CategoryRow {
  id: string
  description?: string | null
  is_active?: boolean | null
  is_internal?: boolean | null
}

export async function categoryOf(container: Container, id: string): Promise<CategoryRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "description", "is_active", "is_internal"],
    filters: { id },
  })
  return (data[0] as CategoryRow | undefined) ?? null
}

export async function storedDocOf(container: Container, categoryId: string): Promise<unknown> {
  const [row] = await catalog(container).listCategoryExtensions(
    { category_id: categoryId },
    { select: ["description_doc"], take: 1 }
  )
  return row?.description_doc ?? null
}

/**
 * A category's text and document for the panel; an unknown category is
 * not found. A document whose text is no longer the category's (changed
 * through Medusa's own route) is none: the editor opens the text.
 */
export async function readCategoryDescription(
  container: Container,
  categoryId: string
): Promise<CategoryDescription> {
  const category = await categoryOf(container, categoryId)
  if (!category) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.category_unknown")
  }
  return {
    category_id: category.id,
    description: category.description ?? "",
    description_doc: currentListingDoc(
      await storedDocOf(container, categoryId),
      category.description ?? ""
    ),
  }
}

/**
 * A shown category's document (adr/0075), for the foot of its page; null
 * without one or with one its text no longer matches (Medusa's own route
 * changed the text: the plain text shows). A hidden or internal category
 * is not found, as its page is not.
 */
export async function storeCategoryDoc(
  container: Container,
  categoryId: string
): Promise<ContentDoc | null> {
  const category = await categoryOf(container, categoryId)
  if (!category || category.is_active === false || category.is_internal === true) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.category_unknown")
  }
  return currentListingDoc(await storedDocOf(container, categoryId), category.description ?? "")
}

interface Plan {
  category_id: string
  /** The document to store; undefined: unchanged. */
  doc?: DescriptionDoc | null
  /** Medusa's plain text to write; undefined: unchanged. */
  description?: string
}

/** What the save changes: the category must be there; the text follows the document. */
const planCategoryDescriptionStep = createStep(
  "catalog-plan-category-description",
  async (input: SetCategoryDescriptionInput, { container }) => {
    const category = await categoryOf(container, input.category_id)
    if (!category) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.category_unknown")
    }
    const changes = listingDescriptionChanges(
      { doc: input.description_doc },
      {
        doc: await storedDocOf(container, input.category_id),
        description: category.description ?? "",
      },
      ""
    )
    const plan: Plan = {
      category_id: input.category_id,
      ...(changes.doc !== undefined ? { doc: changes.doc } : {}),
      ...(changes.description !== undefined ? { description: changes.description ?? "" } : {}),
    }
    return new StepResponse(plan)
  }
)

type Undo = { kind: "created"; id: string } | { kind: "updated"; id: string; doc: unknown }

/** Writes the category's document in its own row, made on its first save; undone, as it was. */
const writeCategoryDocStep = createStep(
  "catalog-write-category-description",
  async (plan: Plan, { container }) => {
    if (plan.doc === undefined) {
      return new StepResponse(undefined)
    }
    const service = catalog(container)
    const [row] = await service.listCategoryExtensions(
      { category_id: plan.category_id },
      { take: 1 }
    )
    if (row) {
      await service.updateCategoryExtensions({ id: row.id, description_doc: plan.doc })
      return new StepResponse<undefined, Undo>(undefined, {
        kind: "updated",
        id: row.id,
        doc: row.description_doc ?? null,
      })
    }
    const created = await service.createCategoryExtensions({
      category_id: plan.category_id,
      description_doc: plan.doc,
    })
    return new StepResponse<undefined, Undo>(undefined, { kind: "created", id: created.id })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = catalog(container)
    if (undo.kind === "created") {
      await service.deleteCategoryExtensions(undo.id)
    } else {
      await service.updateCategoryExtensions({
        id: undo.id,
        description_doc: undo.doc as DescriptionDoc | null,
      })
    }
  }
)

/**
 * Saves a category's text as a document (adr/0075): the document in the
 * catalog extension's row, its plain text as Medusa's `description`
 * through Medusa's own update, so its hooks and `product-category.updated`
 * run (search, the advisor and cached paths read the text again). A lock
 * per category keeps two first saves from making two rows; each step
 * undoes itself if a later one fails.
 */
export const setCategoryDescriptionWorkflow = createWorkflow(
  "catalog-set-category-description",
  (input: SetCategoryDescriptionInput) => {
    const lockKey = transform({ input }, ({ input }) =>
      categoryDescriptionLockKey(input.category_id)
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })

    const plan = planCategoryDescriptionStep(input)
    writeCategoryDocStep(plan)
    when("catalog-category-description-text", { plan }, ({ plan }) => {
      return plan.description !== undefined
    }).then(() => {
      updateProductCategoriesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({
          selector: { id: plan.category_id },
          update: { description: plan.description ?? "" },
        })),
      })
    })

    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(undefined)
  }
)
