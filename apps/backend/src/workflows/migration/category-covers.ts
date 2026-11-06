import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { fakeOrigin } from "../../lib/migration/fetch"
import type {
  SourceCategory,
  SourceProduct,
  StepProblem,
  StepProgress,
} from "../../lib/migration/types"
import { uploadStem } from "../../lib/seo/legacy"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { KeptFile } from "../../modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { setCategoryImageWorkflow } from "../catalog/category-images"
import type { CategoryTree } from "./categories"
import { coverAltText, hostOf, httpsAddress, storedAssets } from "./category-cover-files"
import { ImageRefused, storeImage } from "./images"
import { filePathOf } from "./legacy-addresses"
import type { ReportProblem } from "./report"

/**
 * The moved categories' own pictures (adr/0042 Ek 2026-11-06): each set
 * through the category image workflow, as the panel's "Kategori görseli"
 * card does, with a picture of the media library. A file the migration
 * fetched already (for a product, a post, another category: by its
 * address, its old file's path or stem) is used again; else it is fetched
 * from the old site under the SSRF rules, over HTTPS only (a fake old
 * site's origin in development and tests aside), and stored as a product
 * picture is. A category with a picture here keeps it: never written
 * over. Each set picture is remembered (a run again takes it as set) and
 * its file on the old host kept for its 301 (adr/0059). A picture missing
 * or refused is counted and named, never a stop.
 */

type Container = Pick<MedusaContainer, "resolve">

/** A source category as far as its picture goes. */
export interface CoverCategory {
  source_key: string
  path: readonly string[]
  image?: { url: string; alt: string } | undefined
  /** The picture named but missing from the source's media library (noted by the source). */
  image_missing?: string | undefined
}

/** Where a cover's category is: its id here, `"new"` (a dry run would make it), or null (not here). */
export type CoverTarget = string | null

export interface CoverCounts {
  /** Categories whose source names a picture. */
  found: number
  /** Set (would be). */
  set: number
  /** With a picture here already, the shop's or one a run before set: kept. */
  already_set: number
  /** Set with a file the migration had stored already. */
  reused_asset: number
  /** Fetched from the old site and stored. */
  uploaded: number
  /** Missing from the source, refused, out of reach, or its category not here. */
  failed: number
}

export const emptyCoverCounts = (): CoverCounts => ({
  found: 0,
  set: 0,
  already_set: 0,
  reused_asset: 0,
  uploaded: 0,
  failed: 0,
})

const keyOf = (category: CoverCategory, url: string) => `${category.source_key} ${url}`

export interface CoverOptions {
  progress?: StepProgress
  /** Addresses the same run stores besides (its products' pictures): a dry run counts them as reused. */
  alongside?: ReadonlySet<string>
  fake?: string | undefined
}

/**
 * The categories' pictures set here (or, without `apply`, counted).
 * `targetOf` places each category: its id, `"new"` for one a dry run
 * would make, null for one not here.
 */
export async function setCategoryCovers(
  container: Container,
  source: string,
  categories: readonly CoverCategory[],
  targetOf: (category: CoverCategory) => CoverTarget,
  apply: boolean,
  options: CoverOptions = {}
): Promise<{ counts: CoverCounts; problems: StepProblem[] }> {
  const fake = "fake" in options ? options.fake : fakeOrigin()
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const counts = emptyCoverCounts()
  const problems: StepProblem[] = []
  const named = categories.filter((category) => category.image ?? category.image_missing)
  counts.found = named.length
  // The source named each missing one in its notes
  counts.failed = named.filter((category) => !category.image).length
  const covers = named.flatMap((category) =>
    category.image ? [{ category, url: category.image.url, alt: category.image.alt }] : []
  )
  if (covers.length === 0) {
    return { counts, problems }
  }
  const remembered = await migration.targetsOf(
    source,
    "image",
    covers.map(({ category, url }) => keyOf(category, url))
  )
  const ids = covers.flatMap(({ category }) => {
    const target = targetOf(category)
    return target && target !== "new" ? [target] : []
  })
  const pictured = new Set(
    ids.length
      ? (
          await container
            .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
            .listCategoryImages({ category_id: ids }, { select: ["category_id"], take: null })
        ).map((row) => row.category_id)
      : []
  )
  const assets = await storedAssets(
    container,
    source,
    covers.map(({ url }) => url)
  )
  const predicted = new Set(options.alongside ?? [])
  const kept: KeptFile[] = []
  for (const [index, { category, url, alt }] of covers.entries()) {
    await options.progress?.(index, covers.length)
    const key = keyOf(category, url)
    const target = targetOf(category)
    if (target === null || (apply && target === "new")) {
      counts.failed += 1
      problems.push({ source_key: key, key: "migration.category_cover_no_category" })
      continue
    }
    if (remembered.get(key)?.status === "done" || (target !== "new" && pictured.has(target))) {
      counts.already_set += 1
      continue
    }
    let asset = assets.get(url)
    if (!apply) {
      counts.set += 1
      if (asset || predicted.has(url)) {
        counts.reused_asset += 1
      } else {
        counts.uploaded += 1
        predicted.add(url)
      }
      continue
    }
    try {
      const reused = asset !== undefined
      if (!asset) {
        const stored = await storeImage(container, httpsAddress(url, fake), fake)
        asset = { id: stored.id, url: stored.url }
        assets.set(url, asset)
        counts.uploaded += 1
      }
      await setCategoryImageWorkflow(container as MedusaContainer).run({
        input: { category_id: target, image: { url: asset.url, alt: coverAltText(alt) } },
      })
      await migration.remember(source, "image", [
        { source_key: key, target_id: asset.id, status: "done" },
      ])
      pictured.add(target)
      counts.set += 1
      counts.reused_asset += reused ? 1 : 0
      const path = filePathOf(key, hostOf(source))
      if (path) {
        kept.push({ path, stem: uploadStem(path), media_id: asset.id })
      }
    } catch (error) {
      counts.failed += 1
      if (!(error instanceof ImageRefused)) {
        logger.warn({ event: "migration.category_cover_failed", err: errorSummary(error) })
      }
      problems.push({
        source_key: key,
        key: error instanceof ImageRefused ? error.key : "migration.category_cover_refused",
      })
    }
  }
  if (kept.length > 0) {
    // The old file answers with its new address (adr/0059), as the products' pictures do
    await migration.keepFiles(source, kept)
    await container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
  }
  await options.progress?.(covers.length, covers.length)
  return { counts, problems }
}

/** The run's counts of the pictures, kept with the categories' (the report's lines). */
export interface CoverKindCounts {
  covers: number
  covers_kept: number
  covers_reused: number
  covers_uploaded: number
  covers_failed: number
}

/**
 * A run's step: the pictures of the categories it read (a source that
 * gives none, as every source but WordPress today, leaves it out: null).
 * A dry run counts a category it would make as one to set, and a file
 * its products bring as one to reuse.
 */
export async function migrateCategoryCovers(
  container: Container,
  source: string,
  read: {
    categories: readonly (SourceCategory & Omit<CoverCategory, "path" | "source_key">)[]
    tree: Pick<CategoryTree, "idOf">
    products: readonly SourceProduct[]
  },
  apply: boolean,
  progress: StepProgress
): Promise<{ counts: CoverKindCounts; problems: ReportProblem[] } | null> {
  if (!read.categories.some((category) => category.image ?? category.image_missing)) {
    return null
  }
  const { counts, problems } = await setCategoryCovers(
    container,
    source,
    read.categories,
    (category) => read.tree.idOf(category.path) ?? (apply ? null : "new"),
    apply,
    { progress, alongside: new Set(read.products.flatMap((product) => product.images)) }
  )
  return {
    counts: {
      covers: counts.set,
      covers_kept: counts.already_set,
      covers_reused: counts.reused_asset,
      covers_uploaded: counts.uploaded,
      covers_failed: counts.failed,
    },
    problems: problems.map((problem) => ({ ...problem, kind: "category" as const })),
  }
}
