import { existsSync } from "node:fs"
import { join } from "node:path"
import { entries, imageBytes } from "./preset-load"
import { SectorPackError, readJsonFile } from "./read-json"
import {
  SAMPLES_DIR,
  SAMPLES_FILE,
  SAMPLE_IMAGES_DIR,
  SAMPLE_IMAGE_PATH,
  SAMPLE_LIMITS,
  sampleCatalogSchema,
} from "./sample-schema"
import type { SampleCatalog, SampleCatalogData } from "./sample-schema"

const repeated = (values: readonly string[]): string | undefined =>
  values.find((value, index) => values.indexOf(value) !== index)

/** The images folder: real files only, named as the frame allows, within the limits. */
function readImages(dir: string, where: string): Set<string> {
  const folder = join(dir, SAMPLE_IMAGES_DIR)
  if (!existsSync(folder)) {
    return new Set()
  }
  let total = 0
  const paths = entries(folder, `${where}/${SAMPLE_IMAGES_DIR}`).map((entry) => {
    const path = `${SAMPLE_IMAGES_DIR}/${entry.name}`
    if (!entry.isFile() || !SAMPLE_IMAGE_PATH.test(path)) {
      throw new SectorPackError(`${where}/${path} is not a sample image`)
    }
    total += imageBytes(join(dir, path), `${where}/${path}`, SAMPLE_LIMITS.imageBytes)
    return path
  })
  if (paths.length > SAMPLE_LIMITS.images) {
    throw new SectorPackError(`${where} has over ${String(SAMPLE_LIMITS.images)} images`)
  }
  if (total > SAMPLE_LIMITS.imagesBytes) {
    throw new SectorPackError(
      `${where}'s images are over ${String(SAMPLE_LIMITS.imagesBytes)} bytes`
    )
  }
  return new Set(paths)
}

/**
 * What one file's schema cannot see: handles named once, a category's
 * parent before it, every product's categories known (the set's own or
 * the pack's), its variants matching its options, its images on disk and
 * credited, no image left over.
 */
function checkSamples(
  data: SampleCatalogData,
  images: ReadonlySet<string>,
  packCategories: ReadonlySet<string>,
  where: string
): void {
  const fail = (what: string): never => {
    throw new SectorPackError(`${where}: ${what}`)
  }
  const products = repeated(data.products.map((product) => product.handle))
  if (products) {
    fail(`product ${products} twice`)
  }
  const known = new Set(packCategories)
  for (const category of data.categories) {
    if (data.categories.filter((each) => each.handle === category.handle).length > 1) {
      fail(`category ${category.handle} twice`)
    }
    if (category.parent !== undefined && !known.has(category.parent)) {
      fail(`category ${category.handle}'s parent ${category.parent} is not before it`)
    }
    known.add(category.handle)
  }
  const credited = new Set(data.credits.map((credit) => credit.file))
  const used = new Set<string>()
  for (const product of data.products) {
    for (const handle of product.categories) {
      if (!known.has(handle)) {
        fail(`${product.handle} names an unknown category ${handle}`)
      }
    }
    for (const variant of product.variants) {
      for (const option of product.options) {
        const value = variant.options[option.title]
        if (value === undefined || !option.values.includes(value)) {
          fail(`${product.handle}: a variant has no "${option.title}" of its values`)
        }
      }
    }
    for (const image of product.images) {
      if (!images.has(image)) {
        fail(`${product.handle}'s ${image} is not in ${SAMPLE_IMAGES_DIR}`)
      }
      if (!credited.has(image)) {
        fail(`${image} has no credit`)
      }
      used.add(image)
    }
  }
  const stray = [...images].find((image) => !used.has(image))
  if (stray) {
    fail(`${stray} is not used`)
  }
}

/**
 * A pack's sample catalogue (`samples/samples.json` and its `images`),
 * or null for a pack that has none. Every entry is a real file or folder
 * named as the frame allows; throws `SectorPackError` naming what is wrong.
 */
export function readSamples(
  packDir: string,
  pack: string,
  packCategories: ReadonlySet<string>
): SampleCatalog | null {
  const dir = join(packDir, SAMPLES_DIR)
  if (!existsSync(dir)) {
    return null
  }
  const where = `${pack}/${SAMPLES_DIR}`
  for (const entry of entries(dir, where)) {
    const known = entry.isDirectory()
      ? entry.name === SAMPLE_IMAGES_DIR
      : entry.isFile() && entry.name === SAMPLES_FILE
    if (!known) {
      throw new SectorPackError(`${where}/${entry.name} is not a samples file`)
    }
  }
  if (!existsSync(join(dir, SAMPLES_FILE))) {
    throw new SectorPackError(`${where} has no ${SAMPLES_FILE}`)
  }
  const data = readJsonFile(
    join(dir, SAMPLES_FILE),
    `${where}/${SAMPLES_FILE}`,
    sampleCatalogSchema
  )
  checkSamples(data, readImages(dir, where), packCategories, `${where}/${SAMPLES_FILE}`)
  return { ...data, dir }
}
