import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { isPlanLimitError, isValidationError } from "../../lib/errors"
import { assertStorageFits } from "../../lib/plan-limits"
import { sanitizeImage, suggestedAlts } from "../../lib/media"
import { fakeOrigin } from "../../lib/migration/fetch"
import type { SourceProduct, StepProblem, StepProgress } from "../../lib/migration/types"
import { FetchPace, PACE_MAX } from "../../lib/migration/fetch-pace"
import { ImageRefused, downloadImage } from "../../lib/migration/image-fetch"
import { UPLOAD_MEDIA_TYPES, storedName, validateUpload } from "../../lib/security/upload"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import { removeFiles, storePublicFile } from "../media/files"
import { registerMediaWorkflow, setProductAltsWorkflow } from "../media/workflows"
import { THUMBNAIL_KIND, standInKeyOf, thumbnailChange } from "./thumbnail"
import { keepImageTies, tieVariantImages } from "./variant-images"
import type { ImageWithTies } from "./variant-images"

type Container = Pick<MedusaContainer, "resolve">

export { ImageRefused }

// Pictures handled side by side; their fetches keep to the run's pace (FetchPace)
const CONCURRENCY = PACE_MAX

export interface ImageCounts {
  read: number
  created: number
  found: number
  skipped: number
}

/** A picture's key: the product's and its address (one picture may serve two products). */
const keyOf = (product: SourceProduct, url: string) => `${product.source_key} ${url}`

/**
 * A picture as a product image: checked by its bytes as an upload is (a
 * JPEG, PNG, WebP or AVIF within the limits), stored cleaned (upright, no
 * EXIF or GPS), and registered with the media pipeline (F3.3). Its id.
 * A cover no product takes (`versions`) gets its versions as a library
 * upload does; a product's picture gets them from its product.
 */
export async function storeImage(
  container: Container,
  address: string,
  fake: string | undefined = fakeOrigin(),
  { versions = false, pace }: { versions?: boolean; pace?: FetchPace } = {}
) {
  const bytes = await downloadImage(address, fake, pace)
  const last = new URL(address).pathname.split("/").pop() ?? ""
  let name = "gorsel"
  try {
    name = decodeURIComponent(last) || name
  } catch {
    // A broken escape ("%E0") names nothing: the picture keeps the plain name
  }
  let type
  try {
    type = validateUpload({ buffer: bytes, originalname: name })
  } catch (error) {
    if (isValidationError(error)) {
      throw new ImageRefused("migration.image_not_accepted")
    }
    throw error
  }
  let clean
  try {
    clean = await sanitizeImage(bytes, type.type)
  } catch {
    throw new ImageRefused("migration.image_not_accepted")
  }
  // adr/0061 Ek C14 review M3: within the package's storage, or the picture is
  // named in the report and its product moves without it
  await withinStorage(() => assertStorageFits(container, clean.buffer.length))
  const file = await storePublicFile(
    container as MedusaContainer,
    storedName(name, type),
    UPLOAD_MEDIA_TYPES[type.type].mime,
    clean.buffer
  )
  const { result } = await withinStorage(
    () =>
      registerMediaWorkflow(container as MedusaContainer).run({
        input: { file_ids: [file.id], versions },
      }),
    // Another write took the last megabytes meanwhile: the stored file goes again
    () => removeFiles(container as MedusaContainer, [file.id])
  )
  const asset = result[0]
  if (!asset) {
    throw new ImageRefused("migration.image_not_accepted")
  }
  return asset
}

/** A plan storage refusal as the picture's own (`migration.image_plan_limit`). */
async function withinStorage<T>(work: () => Promise<T>, undo?: () => Promise<unknown>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!isPlanLimitError(error)) {
      throw error
    }
    await undo?.()
    throw new ImageRefused("migration.image_plan_limit")
  }
}

type Outcome =
  { url: string; asset: Awaited<ReturnType<typeof storeImage>> } | { url: string; key: string }

/** Each item worked on, CONCURRENCY at a time, the results in order. */
export async function inTurns<T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
  return results
}

/**
 * The moved products' pictures here (F14.4, adr/0042 §7): each fetched
 * once (a run again fetches only the ones it had not), added after the
 * product's own in the source's order (theirs kept with their variant
 * ties), the first its thumbnail when it had none (`thumbnail.ts`: the
 * featured picture replaces a stand-in on a later run), each with the old
 * site's alt text or one from the product's name, a variation's own tied
 * to its variant (`variant-images.ts`). A host that turns fetches away is
 * tried again, slower (`lib/migration/image-fetch.ts`, adr/0042 Ek
 * 2026-11-20). A picture refused or out of reach is named in the report
 * with why; its product stays. A dry run counts the pictures it would fetch.
 */
export async function migrateImages(
  container: Container,
  source: string,
  products: readonly SourceProduct[],
  apply: boolean,
  progress: StepProgress,
  fake: string | undefined = fakeOrigin(),
  // One pace for the run: the old site answers all of its fetches (the posts' pictures' too)
  pace: FetchPace = new FetchPace()
): Promise<{ counts: ImageCounts; problems: StepProblem[] }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const counts: ImageCounts = { read: 0, created: 0, found: 0, skipped: 0 }
  const problems: StepProblem[] = []
  const targets = await migration.targetsOf(
    source,
    "product",
    products.map((product) => product.source_key)
  )
  for (const [index, product] of products.entries()) {
    const urls = [...new Set(product.images)]
    counts.read += urls.length
    const before = await migration.targetsOf(
      source,
      "image",
      urls.map((url) => keyOf(product, url))
    )
    const fresh = urls.filter((url) => before.get(keyOf(product, url))?.status !== "done")
    counts.found += urls.length - fresh.length
    const productId = targets.get(product.source_key)?.target_id
    if (!apply || fresh.length === 0 || !productId) {
      counts.created += apply ? 0 : fresh.length
      await progress(index + 1, products.length)
      continue
    }
    const outcomes = await inTurns(fresh, async (url): Promise<Outcome> => {
      try {
        return { url, asset: await storeImage(container, url, fake, { pace }) }
      } catch (error) {
        if (error instanceof ImageRefused) {
          return { url, key: error.key }
        }
        throw error
      }
    })
    const stored = outcomes.flatMap((outcome) => ("asset" in outcome ? [outcome] : []))
    const { data } = await query.graph({
      entity: "product",
      fields: ["title", "thumbnail", "images.id", "images.url", "images.variants.id"],
      filters: { id: productId },
    })
    const current = data[0] as
      | {
          title: string
          thumbnail: string | null
          images: ImageWithTies[] | null
        }
      | undefined
    if (stored.length > 0 && current) {
      const kept = (current.images ?? []).map((image) => image.url)
      const urlsAfter = [...kept, ...stored.map(({ asset }) => asset.url)]
      const featured = product.images[0]
      const standInKey = standInKeyOf(product.source_key)
      const standIn = (await migration.targetsOf(source, THUMBNAIL_KIND, [standInKey])).get(
        standInKey
      )
      const change = thumbnailChange({
        current,
        standIn: standIn?.status === "done" ? (standIn.target_id ?? null) : null,
        first: urlsAfter[0] ?? null,
        featured: stored.find(({ url }) => url === featured)?.asset.url ?? null,
        featuredFailed: outcomes.some((each) => each.url === featured && "key" in each),
      })
      await updateProductsWorkflow(container as MedusaContainer).run({
        input: {
          selector: { id: productId },
          update: {
            // The product's own kept as they are (by id), the new ones after them
            images: [
              ...(current.images ?? []).map(({ id, url }) => ({ id, url })),
              ...stored.map(({ asset }) => ({ url: asset.url })),
            ],
            ...(change.thumbnail ? { thumbnail: change.thumbnail } : {}),
          },
        },
      })
      const alts = suggestedAlts({
        title: current.title,
        images: urlsAfter.map(() => ({ variantIds: [] })),
        variantValues: new Map(),
      }).slice(kept.length)
      await setProductAltsWorkflow(container as MedusaContainer).run({
        input: {
          product_id: productId,
          // The old site's own alt text where it gave one
          alts: stored.map(({ asset, url }, place) => ({
            id: asset.id,
            alt: product.image_alts?.[url] ?? alts[place] ?? null,
          })),
        },
      })
      if (change.standIn !== undefined) {
        // "skipped": the stand-in record cleared, the featured picture in its place
        await migration.remember(source, THUMBNAIL_KIND, [
          {
            source_key: standInKey,
            target_id: change.standIn,
            status: change.standIn ? "done" : "skipped",
          },
        ])
      }
      // The ties the product's pictures had stay, whatever the save rebuilt
      await keepImageTies(container, productId, current.images ?? [])
      // A variation's own picture shows when its variant is chosen
      await tieVariantImages(
        container,
        productId,
        product,
        new Map(stored.map(({ url, asset }) => [url, asset.url]))
      )
    }
    const items: RememberedItem[] = outcomes.map((outcome) =>
      "asset" in outcome
        ? { source_key: keyOf(product, outcome.url), target_id: outcome.asset.id, status: "done" }
        : {
            source_key: keyOf(product, outcome.url),
            target_id: null,
            status: "skipped",
            error_code: outcome.key,
          }
    )
    await migration.remember(source, "image", items)
    counts.created += stored.length
    for (const outcome of outcomes) {
      if ("key" in outcome) {
        counts.skipped += 1
        problems.push({ source_key: keyOf(product, outcome.url), key: outcome.key })
      }
    }
    await progress(index + 1, products.length)
  }
  return { counts, problems }
}
