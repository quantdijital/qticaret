import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { currentListingDoc, listingDescriptionDoc } from "../../lib/catalog/listing-description"
import type { ContentDoc } from "../../lib/content/doc"
import { rewriteDocHrefs } from "../../lib/content/links"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { saveBrandWorkflow } from "../brands/workflows"
import {
  categoryOf,
  setCategoryDescriptionWorkflow,
  storedDocOf,
} from "../catalog/category-description"
import { setCollectionDetailsWorkflow } from "../catalog/collection-details"
import type { LinkDocument } from "./link-plan"

/**
 * Categories', brands' and collections' description documents (adr/0075)
 * in the link rewrite (adr/0042 Ek 2026-11-05): read as the storefront
 * shows them (a document whose text is no longer the record's is stale
 * and shows nowhere, so it is neither read nor written), written back
 * through each one's own save (the category's description workflow, the
 * brand's and the collection's saves): their locks, their plain-text
 * mirror, their events and their undo, as a save from the panel.
 */

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 200

export type ListingKind = "category" | "brand" | "collection"

/** A listing whose description has a link to change. */
export interface ListingWrite {
  kind: ListingKind
  id: string
}

// A stored document: a JSON column with something in it
const WITH_DOC = { description_doc: { $ne: null } } as Record<string, unknown>

const catalog = (container: Container) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

export async function* categoryDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let skip = 0; ; skip += PAGE) {
    const rows = await catalog(container).listCategoryExtensions(
      { ...WITH_DOC, ...(ids ? { category_id: [...ids] } : {}) },
      { select: ["category_id", "description_doc"], skip, take: PAGE, order: { id: "ASC" } }
    )
    const { data } =
      rows.length > 0
        ? await query.graph({
            entity: "product_category",
            fields: ["id", "name", "description"],
            filters: { id: rows.map((row) => row.category_id) },
          })
        : { data: [] }
    const categories = new Map(
      (data as { id: string; name: string; description?: string | null }[]).map((row) => [
        row.id,
        row,
      ])
    )
    for (const row of rows) {
      // A deleted category's row is an orphan (adr/0075 §9): no page, nothing to read
      const category = categories.get(row.category_id)
      const doc = category
        ? currentListingDoc(row.description_doc, category.description ?? "")
        : null
      if (category && doc) {
        yield { kind: "category", id: category.id, title: category.name, doc }
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

export async function* brandDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  for (let skip = 0; ; skip += PAGE) {
    const rows = await service.listBrands(
      { ...WITH_DOC, ...(ids ? { id: [...ids] } : {}) },
      {
        select: ["id", "name", "description", "description_doc"],
        skip,
        take: PAGE,
        order: { id: "ASC" },
      }
    )
    for (const row of rows) {
      const doc = currentListingDoc(row.description_doc, row.description)
      if (doc) {
        yield { kind: "brand", id: row.id, title: row.name, doc }
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

interface CollectionRow {
  id: string
  title: string
  collection_extension?: { description: string | null; description_doc: unknown } | null
}

async function collectionRows(
  container: Container,
  filters: Record<string, unknown>,
  skip: number
): Promise<CollectionRow[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: [
      "id",
      "title",
      "collection_extension.description",
      "collection_extension.description_doc",
    ],
    filters,
    pagination: { skip, take: PAGE, order: { id: "ASC" } },
  })
  return data
}

const collectionDoc = (row: CollectionRow): ContentDoc | null =>
  row.collection_extension
    ? currentListingDoc(
        row.collection_extension.description_doc,
        row.collection_extension.description
      )
    : null

export async function* collectionDocuments(
  container: Container,
  ids: readonly string[] | null
): AsyncGenerator<LinkDocument> {
  if (ids?.length === 0) {
    return
  }
  for (let skip = 0; ; skip += PAGE) {
    const rows = await collectionRows(container, ids ? { id: [...ids] } : {}, skip)
    for (const row of rows) {
      const doc = collectionDoc(row)
      if (doc) {
        yield { kind: "collection", id: row.id, title: row.title, doc }
      }
    }
    if (rows.length < PAGE) {
      return
    }
  }
}

/** A listing's document as it is now (stale or none: null). */
async function listingDocOf(container: Container, item: ListingWrite): Promise<ContentDoc | null> {
  if (item.kind === "category") {
    const category = await categoryOf(container, item.id)
    return category
      ? currentListingDoc(await storedDocOf(container, item.id), category.description ?? "")
      : null
  }
  if (item.kind === "brand") {
    const [row] = await container
      .resolve<BrandsModuleService>(BRANDS_MODULE)
      .listBrands({ id: item.id }, { select: ["description", "description_doc"], take: 1 })
    return row ? currentListingDoc(row.description_doc, row.description) : null
  }
  const [row] = await collectionRows(container, { id: item.id }, 0)
  return row ? collectionDoc(row) : null
}

/** A listing's document saved as the panel saves it; its plain text follows it. */
async function saveListingDoc(
  container: Container,
  item: ListingWrite,
  doc: ContentDoc
): Promise<void> {
  const scope = container as MedusaContainer
  if (item.kind === "category") {
    await setCategoryDescriptionWorkflow(scope).run({
      input: { category_id: item.id, description_doc: doc },
    })
  } else if (item.kind === "brand") {
    await saveBrandWorkflow(scope).run({ input: { id: item.id, values: { description_doc: doc } } })
  } else {
    await setCollectionDetailsWorkflow(scope).run({
      input: { collection_id: item.id, description_doc: doc },
    })
  }
}

export interface RewriteListingsInput {
  listings: ListingWrite[]
  next: Record<string, string>
}

type Previous = ListingWrite & { doc: ContentDoc }

/**
 * Each listing's document read again as it is now, its links given their
 * new addresses, saved only when one changed (each save under its own
 * lock); how many were written. Undone, each is saved back as it was.
 */
export const rewriteListingLinksStep = createStep(
  "content-rewrite-listing-links",
  async (input: RewriteListingsInput, { container }) => {
    const next = new Map(Object.entries(input.next))
    const previous: Previous[] = []
    for (const item of input.listings) {
      const doc = await listingDocOf(container, item)
      const out = doc ? rewriteDocHrefs(doc, next) : null
      // The new addresses are the shop's own paths; checked again as a save from the panel is
      const checked = out && out.changed > 0 ? listingDescriptionDoc.safeParse(out.doc) : null
      if (doc && checked?.success) {
        await saveListingDoc(container, item, checked.data)
        previous.push({ ...item, doc })
      }
    }
    return new StepResponse(previous.length, previous)
  },
  async (previous, { container }) => {
    for (const item of [...(previous ?? [])].reverse()) {
      await saveListingDoc(container, item, item.doc)
    }
  }
)
