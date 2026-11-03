import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { isValidationError } from "../../lib/errors"
import { sanitizeImage, suggestedAlts } from "../../lib/media"
import { fakeOrigin } from "../../lib/migration/fetch"
import type { SourceProduct, StepProblem, StepProgress } from "../../lib/migration/types"
import { isSafeFetchError, safeFetch } from "../../lib/security/safe-fetch"
import {
  DEFAULT_UPLOAD_LIMITS,
  UPLOAD_MEDIA_TYPES,
  storedName,
  validateUpload,
} from "../../lib/security/upload"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import { storePublicFile } from "../media/files"
import { registerMediaWorkflow, setProductAltsWorkflow } from "../media/workflows"

type Container = Pick<MedusaContainer, "resolve">

const FETCH_TIMEOUT_MS = 20_000
// Pictures fetched side by side: kind to the old site, quick enough for a shop
const CONCURRENCY = 4

export interface ImageCounts {
  read: number
  created: number
  found: number
  skipped: number
}

/** A picture's key: the product's and its address (one picture may serve two products). */
const keyOf = (product: SourceProduct, url: string) => `${product.source_key} ${url}`

/** A picture not taken, and why (an error key for the report). */
export class ImageRefused extends Error {
  constructor(readonly key: string) {
    super(key)
  }
}

const REFUSALS: Readonly<Record<string, string>> = {
  address_not_allowed: "migration.image_address_refused",
  protocol_not_allowed: "migration.image_address_refused",
  credentials_in_url: "migration.image_address_refused",
  port_not_allowed: "migration.image_address_refused",
  invalid_url: "migration.image_address_refused",
  redirect_not_allowed: "migration.image_address_refused",
  response_too_large: "migration.image_too_large",
}

/**
 * A picture's bytes from the old site, under the SSRF rules (docs/04,
 * adr/0042 §7, KK4): public addresses only, every redirect checked again,
 * the upload size cap. A fake provider's own origin (development, tests)
 * is reached directly, without redirects.
 */
async function download(address: string, fake: string | undefined): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw new ImageRefused("migration.image_address_refused")
  }
  try {
    if (fake && new URL(fake).origin === url.origin) {
      const answer = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (answer.status !== 200) {
        throw new ImageRefused("migration.image_unreachable")
      }
      return Buffer.from(await answer.arrayBuffer())
    }
    const answer = await safeFetch(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxResponseBytes: DEFAULT_UPLOAD_LIMITS.maxBytes,
      maxRedirects: 3,
      redirect: "follow",
    })
    if (answer.status !== 200) {
      throw new ImageRefused("migration.image_unreachable")
    }
    return answer.body
  } catch (error) {
    if (error instanceof ImageRefused) {
      throw error
    }
    if (isSafeFetchError(error)) {
      throw new ImageRefused(REFUSALS[error.reason] ?? "migration.image_unreachable")
    }
    throw new ImageRefused("migration.image_unreachable")
  }
}

/**
 * A picture as a product image: checked by its bytes as an upload is (a
 * JPEG, PNG, WebP or AVIF within the limits), stored cleaned (upright, no
 * EXIF or GPS), and registered with the media pipeline (F3.3). Its id.
 */
export async function storeImage(
  container: Container,
  address: string,
  fake: string | undefined = fakeOrigin()
) {
  const bytes = await download(address, fake)
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
  if (type.type === "csv") {
    throw new ImageRefused("migration.image_not_accepted")
  }
  let clean
  try {
    clean = await sanitizeImage(bytes, type.type)
  } catch {
    throw new ImageRefused("migration.image_not_accepted")
  }
  const file = await storePublicFile(
    container as MedusaContainer,
    storedName(name, type),
    UPLOAD_MEDIA_TYPES[type.type].mime,
    clean.buffer
  )
  const { result } = await registerMediaWorkflow(container as MedusaContainer).run({
    input: { file_ids: [file.id] },
  })
  const asset = result[0]
  if (!asset) {
    throw new ImageRefused("migration.image_not_accepted")
  }
  return asset
}

type Outcome =
  { url: string; asset: Awaited<ReturnType<typeof storeImage>> } | { url: string; key: string }

async function inTurns<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
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
 * product's own in the source's order, the first its thumbnail when it
 * had none, each with the old site's alt text or one from the product's name. A picture
 * refused or out of reach is named in the report; its product stays. A
 * dry run counts the pictures it would fetch.
 */
export async function migrateImages(
  container: Container,
  source: string,
  products: readonly SourceProduct[],
  apply: boolean,
  progress: StepProgress,
  fake: string | undefined = fakeOrigin()
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
        return { url, asset: await storeImage(container, url, fake) }
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
      fields: ["title", "thumbnail", "images.url"],
      filters: { id: productId },
    })
    const current = data[0] as
      { title: string; thumbnail: string | null; images: { url: string }[] | null } | undefined
    if (stored.length > 0 && current) {
      const kept = (current.images ?? []).map((image) => image.url)
      const urlsAfter = [...kept, ...stored.map(({ asset }) => asset.url)]
      await updateProductsWorkflow(container as MedusaContainer).run({
        input: {
          selector: { id: productId },
          update: {
            images: urlsAfter.map((url) => ({ url })),
            ...(current.thumbnail ? {} : { thumbnail: urlsAfter[0] }),
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
