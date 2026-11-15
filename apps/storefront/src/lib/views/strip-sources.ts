import "server-only"
import type { StripRecordKind } from "@qticaret/types"
import type { ImageView, Translate } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { categoryCounts, collectionDetails } from "@/lib/store-api/extras"
import {
  brandById,
  collectionById,
  listProducts,
  pathsOf,
  priceDisplays,
  productIdsOf,
} from "@/lib/store-api/requests"
import { picturedCategories } from "./category-tiles"
import { imageView, productImages } from "./image"
import { mapLimited } from "./limited"
import { PHOTO_REQUESTS } from "./nav-pictures"
import { productCards, variantIdsOf } from "./product"
import { productsInOrder } from "./section-data"
import { cardOptions } from "./theme-settings"

/**
 * What a strip gallery's sources give a strip the shop left empty
 * (adr/0049 Ek 2026-11-16), fetched live from the Store API: each
 * record's name, its page, a picture (its own, else its newest product's
 * photo) and a line of its own: a product's price as a card shows it (the
 * shopper's price, worked out by the backend, never the design's), a
 * category's product count. A record with no live page here, or one the
 * backend could not answer for, is not in the map: its strip is left out.
 */
export interface SourceFacts {
  name: string
  path: string
  image: ImageView | null
  note: string | null
}

export type SourceMap = ReadonlyMap<string, SourceFacts>

/** A source's key in the map. */
export const sourceKey = (kind: StripRecordKind, id: string) => `${kind}:${id}`

/** The answer, or none when the backend could not give it (the home page is not a source's to break). */
async function orNone<T>(load: () => Promise<T>, none: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isStoreApiError(error)) {
      return none
    }
    throw error
  }
}

const firstPhoto = (products: Parameters<typeof productImages>[0][]): ImageView | null => {
  const [photo] = products[0] ? productImages(products[0]) : []
  return photo ? { ...photo, alt: "" } : null
}

async function products(ids: readonly string[], t: Translate): Promise<[string, SourceFacts][]> {
  const found = await productsInOrder(ids)
  if (found.length === 0) {
    return []
  }
  const [paths, displays, options] = await Promise.all([
    pathsOf(
      "product",
      found.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(found)),
    cardOptions(),
  ])
  return productCards(found, paths, displays, options).map((card) => [
    sourceKey("product", card.id),
    {
      name: card.title,
      path: card.path,
      image: card.image,
      note: card.price
        ? card.price.from
          ? t("price.from", { price: card.price.current })
          : card.price.current
        : null,
    },
  ])
}

async function categories(ids: readonly string[], t: Translate): Promise<[string, SourceFacts][]> {
  const [cards, counts] = await Promise.all([picturedCategories(ids), categoryCounts()])
  return cards.map(({ id, card }) => {
    const count = counts.get(id)
    return [
      sourceKey("category", id),
      {
        name: card.label,
        path: card.path,
        image: card.image ?? null,
        note:
          typeof count === "number" && count > 0
            ? t("listing.count", { count: count.toLocaleString("tr-TR") })
            : null,
      },
    ]
  })
}

async function collections(ids: readonly string[]): Promise<[string, SourceFacts][]> {
  const paths = await pathsOf("product_collection", ids)
  const found = await mapLimited(ids, PHOTO_REQUESTS, async (id) => {
    const path = paths[id]
    if (!path) {
      return null
    }
    const [answer, details] = await Promise.all([
      orNone(() => collectionById(id), null),
      collectionDetails(id),
    ])
    if (!answer) {
      return null
    }
    const name = answer.collection.title
    const image = details.image
      ? imageView(details.image, "")
      : firstPhoto(
          (
            await orNone(
              () => listProducts({ limit: 1, order: "-created_at", collectionIds: [id] }),
              { products: [], count: 0 }
            )
          ).products
        )
    return [sourceKey("collection", id), { name, path, image, note: null }] as [string, SourceFacts]
  })
  return found.filter((entry) => entry !== null)
}

async function brands(ids: readonly string[]): Promise<[string, SourceFacts][]> {
  const paths = await pathsOf("brand", ids)
  const found = await mapLimited(ids, PHOTO_REQUESTS, async (id) => {
    const path = paths[id]
    const answer = path ? await orNone(() => brandById(id), null) : null
    if (!path || !answer) {
      return null
    }
    // A brand's logo is a mark, not a photograph: its newest product's photo stands for it
    const { product_ids: newest } = await orNone(
      () => productIdsOf("brands", id, { limit: 1, offset: 0 }),
      { product_ids: [], count: 0 }
    )
    const image = firstPhoto(await orNone(() => productsInOrder(newest), []))
    return [sourceKey("brand", id), { name: answer.brand.name, path, image, note: null }] as [
      string,
      SourceFacts,
    ]
  })
  return found.filter((entry) => entry !== null)
}

/** Every source the strips name, each kind in one go, all kinds at once. */
export async function stripSources(
  sources: readonly { kind: StripRecordKind; target: string }[],
  t: Translate
): Promise<SourceMap> {
  const of = (kind: StripRecordKind) => [
    ...new Set(sources.filter((source) => source.kind === kind).map((source) => source.target)),
  ]
  const none = (): Promise<[string, SourceFacts][]> => Promise.resolve([])
  const want = (
    kind: StripRecordKind,
    load: (ids: string[]) => Promise<[string, SourceFacts][]>
  ) => (of(kind).length > 0 ? orNone(() => load(of(kind)), []) : none())
  const found = await Promise.all([
    want("product", (ids) => products(ids, t)),
    want("category", (ids) => categories(ids, t)),
    want("collection", collections),
    want("brand", brands),
  ])
  return new Map(found.flat())
}
