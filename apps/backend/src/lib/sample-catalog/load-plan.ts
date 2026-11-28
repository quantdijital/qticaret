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

// The handles looked up at once for each product: the set's and its first few `-ornek` forms
const CANDIDATES = 5
// Rounds of candidates looked up for one product before the load gives up
const MAX_ROUNDS = 20

/** The n-th form of a handle: the set's, then `-ornek`, `-ornek-2`... */
const candidateAt = (handle: string, n: number): string =>
  n === 0 ? handle : n === 1 ? `${handle}-${SUFFIX}` : `${handle}-${SUFFIX}-${String(n)}`

/** A round of forms looked up together, from the `from`-th on. */
export const handleCandidates = (handle: string, from = 0): string[] =>
  Array.from({ length: CANDIDATES + 1 }, (_, index) => candidateAt(handle, from + index))

/**
 * Each product's handle here: the set's, else the first `-ornek` form no
 * product has and no address holds. Every form chosen was looked up
 * (`lookup` answers the ones taken): the first round for all products at
 * once, a further round only for a product whose forms were all taken
 * (security review 2026-11-28, D4). Two products never get one handle.
 */
export async function chooseHandles(
  handles: readonly string[],
  lookup: (candidates: string[]) => Promise<string[]>
): Promise<Record<string, string>> {
  const checked = new Set<string>()
  const taken = new Set<string>()
  const check = async (candidates: string[]) => {
    const fresh = [...new Set(candidates.filter((candidate) => !checked.has(candidate)))]
    if (fresh.length === 0) {
      return
    }
    for (const handle of await lookup(fresh)) {
      taken.add(handle)
    }
    fresh.forEach((candidate) => checked.add(candidate))
  }
  await check(handles.flatMap((handle) => handleCandidates(handle)))
  const chosen: Record<string, string> = {}
  for (const handle of handles) {
    for (let round = 0; ; round += 1) {
      if (round === MAX_ROUNDS) {
        throw new Error(`sample-catalog: no free handle for ${handle}`)
      }
      const batch = handleCandidates(handle, round * (CANDIDATES + 1))
      await check(batch)
      const free = batch.find((candidate) => !taken.has(candidate))
      if (free !== undefined) {
        taken.add(free)
        chosen[handle] = free
        break
      }
    }
  }
  return chosen
}

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
  const handles = await chooseHandles(
    samples.products.map((product) => product.handle),
    async (candidates) => [
      ...(
        await products.listProducts({ handle: candidates }, { select: ["handle"], take: null })
      ).map((product) => product.handle),
      ...(await heldHandles(container, candidates)),
    ]
  )
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
    handles,
    template_ids: Object.fromEntries(templates.map((template) => [template.handle, template.id])),
    sales_channel_id: store?.default_sales_channel_id ?? null,
  }
}
