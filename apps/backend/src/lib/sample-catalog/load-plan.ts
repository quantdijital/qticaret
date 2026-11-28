import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { packItemKey, sectorPack } from "@qticaret/sector-packs"
import type { SampleCatalog } from "@qticaret/sector-packs"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../workflows/catalog/entity-paths"
import { ValidationError } from "../errors"
import { URL_STYLES, productPath } from "../seo/url-patterns"
import { sampleTag } from "./mark"
import { readSampleRows } from "./read"

type Container = Pick<MedusaContainer, "resolve">

export interface CategoryToMake {
  handle: string
  name: string
  parent: string | null
  description: string | null
}

export interface SampleLoadPlan {
  pack: string
  tag: string
  /** Categories the products need that the shop does not have, parents first. */
  make: CategoryToMake[]
  /** Hidden categories the pack made here that a sample goes into: shown while samples are in. */
  open: { id: string; handle: string }[]
  /** Every handle the products name, with the category it is here (made ones added later). */
  category_ids: Record<string, string>
  /** Each product's handle here: its own, or with `-ornek` when the shop has one by that name. */
  handles: Record<string, string>
  template_ids: Record<string, string>
  sales_channel_id: string | null
}

const SUFFIX = "ornek"

/** A handle not taken here: the set's, else `-ornek`, `-ornek-2`... */
export function freeHandle(handle: string, taken: ReadonlySet<string>): string {
  if (!taken.has(handle)) {
    return handle
  }
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? `${handle}-${SUFFIX}` : `${handle}-${SUFFIX}-${String(n)}`
    if (!taken.has(candidate)) {
      return candidate
    }
  }
}

// The handles looked up at once: the set's and its first few `-ornek` forms
const CANDIDATES = 5

export const handleCandidates = (handle: string): string[] => [
  handle,
  ...Array.from({ length: CANDIDATES }, (_, index) =>
    index === 0 ? `${handle}-${SUFFIX}` : `${handle}-${SUFFIX}-${String(index + 1)}`
  ),
]

/**
 * The handles whose product address, in either URL style, a record holds
 * in the URL registry (a deleted product's path kept for its 410, a page
 * by the same name in the flat style): claiming one would be refused.
 */
async function heldHandles(container: Container, handles: readonly string[]): Promise<string[]> {
  const byPath = new Map(
    handles.flatMap((handle) => URL_STYLES.map((style) => [productPath(handle, style), handle]))
  )
  const held = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: CATALOG_LOCALE, path: [...byPath.keys()] },
      { select: ["path"], take: null }
    )
  return held.flatMap((entry) => byPath.get(entry.path) ?? [])
}

/** The categories the products need, with the parents they hang on, parents first. */
export function neededCategories(
  samples: SampleCatalog,
  packCategories: readonly CategoryToMake[]
) {
  const known = new Map<string, CategoryToMake>()
  for (const category of packCategories) {
    known.set(category.handle, category)
  }
  for (const category of samples.categories) {
    known.set(category.handle, {
      handle: category.handle,
      name: category.name,
      parent: category.parent ?? null,
      description: category.description ?? null,
    })
  }
  const ordered: CategoryToMake[] = []
  const add = (handle: string) => {
    const category = known.get(handle)
    if (!category || ordered.some((each) => each.handle === handle)) {
      return
    }
    if (category.parent) {
      add(category.parent)
    }
    ordered.push(category)
  }
  for (const product of samples.products) {
    product.categories.forEach(add)
  }
  return ordered
}

/**
 * What loading a pack's sample catalogue will do here, read before any
 * write: refused for a pack with no samples (unknown), one the shop was
 * not given, or one whose samples are here already.
 */
export async function planSampleLoad(container: Container, pack: string): Promise<SampleLoadPlan> {
  const found = sectorPack(pack)
  const samples = found?.samples
  if (!found || !samples) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "sample_catalog.unknown")
  }
  const ledger = container.resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
  const [applied] = await ledger.listSectorPackApplications({ pack }, { select: ["id"], take: 1 })
  if (!applied) {
    throw new ValidationError("sample_catalog.pack_not_applied", { field: "pack" })
  }
  const rows = await readSampleRows(container)
  if (rows.products.some((product) => product.pack === pack)) {
    throw new ValidationError("sample_catalog.already_loaded", { field: "pack" })
  }
  const needed = neededCategories(
    samples,
    found.categories.map((category) => ({
      handle: category.handle,
      name: category.name,
      parent: category.parent ?? null,
      description: category.description ?? null,
    }))
  )
  const products = container.resolve(Modules.PRODUCT)
  const existing = await products.listProductCategories(
    { handle: needed.map((category) => category.handle) },
    { select: ["id", "handle", "is_active"], take: null }
  )
  const byHandle = new Map(existing.map((category) => [category.handle, category]))
  // Hidden and the pack's own (its ledger names it as made): the shop hid none of its own here
  const offered = await ledger.offeredItems(pack)
  const open = existing.filter((category) => {
    const item = offered.get(packItemKey.category(category.handle))
    return !category.is_active && item?.outcome === "added" && item.record_id === category.id
  })
  const candidates = samples.products.flatMap((product) => handleCandidates(product.handle))
  const taken = await products.listProducts(
    { handle: candidates },
    { select: ["handle"], take: null }
  )
  const takenHandles = new Set([
    ...taken.map((product) => product.handle),
    ...(await heldHandles(container, candidates)),
  ])
  const templates = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeTemplates(
      { handle: [...new Set(samples.products.flatMap((product) => product.template ?? []))] },
      { select: ["id", "handle"], take: null }
    )
  const { data: stores } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const store = stores[0] as { default_sales_channel_id?: string | null } | undefined
  return {
    pack,
    tag: sampleTag(pack, samples.version),
    make: needed.filter((category) => !byHandle.has(category.handle)),
    open: open.map((category) => ({ id: category.id, handle: category.handle })),
    category_ids: Object.fromEntries(existing.map((category) => [category.handle, category.id])),
    handles: Object.fromEntries(
      samples.products.map((product) => {
        const handle = freeHandle(product.handle, takenHandles)
        takenHandles.add(handle)
        return [product.handle, handle]
      })
    ),
    template_ids: Object.fromEntries(templates.map((template) => [template.handle, template.id])),
    sales_channel_id: store?.default_sales_channel_id ?? null,
  }
}
