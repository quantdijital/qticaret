import type { MedusaContainer } from "@medusajs/framework/types"
import { sectorPack } from "@qticaret/sector-packs"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { blockReason } from "./plan"
import type { BlockReason } from "./plan"
import { readSampleRows } from "./read"

type Container = Pick<MedusaContainer, "resolve">

export interface SampleSet {
  pack: string
  /** As the pack names it ("Örnek turlar"). */
  name: string
  version: number
  /** How many products the set brings. */
  products: number
  /** Its products are here now. */
  loaded: boolean
}

export interface SampleStatus {
  /** The sets of the packs this shop was given. */
  sets: SampleSet[]
  /** No product of the shop's own: a new shop, offered the set at once. */
  catalog_empty: boolean
  products: {
    id: string
    title: string
    handle: string
    thumbnail: string | null
    pack: string
    edited: boolean
    /** Why "Örnek içeriği kaldır" leaves it: an order, a sold or held place, a customer's words. */
    blocked: BlockReason | null
    /** Reviews, questions and answers customers wrote on it. */
    customer_content: number
  }[]
  categories: number
  reviews: number
}

/** What the panel's "Örnek içerik" card shows: the sets on offer and what is loaded. */
export async function sampleStatus(container: Container): Promise<SampleStatus> {
  const applied = await container
    .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
    .listSectorPackApplications({}, { select: ["pack"], take: null })
  const rows = await readSampleRows(container)
  const loadedPacks = new Set(rows.products.map((product) => product.pack))
  const sets = applied.flatMap((row): SampleSet[] => {
    const samples = sectorPack(row.pack)?.samples
    return samples
      ? [
          {
            pack: row.pack,
            name: samples.name,
            version: samples.version,
            products: samples.products.length,
            loaded: loadedPacks.has(row.pack),
          },
        ]
      : []
  })
  return {
    sets,
    catalog_empty: rows.own_products === 0,
    products: rows.products.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      thumbnail: product.thumbnail,
      pack: product.pack,
      edited: product.edited,
      blocked: blockReason(product),
      customer_content: product.customer_content,
    })),
    categories: rows.categories.filter((category) => category.sample).length,
    reviews: rows.reviews.length,
  }
}
