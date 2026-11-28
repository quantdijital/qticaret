import { sectorPack } from "@qticaret/sector-packs"
import type { SampleCatalog } from "@qticaret/sector-packs"

/**
 * Test runs only (`NODE_ENV=test`): the set cut to its first N products,
 * one picture each, so an integration test loads it in seconds instead
 * of minutes. Read from the process environment the test sets before the
 * app starts; ignored everywhere else, so no shop ever gets a cut set.
 */
export const TEST_SAMPLE_LIMIT_ENV = "QT_TEST_SAMPLE_LIMIT"

export function testSampleLimit(env: NodeJS.ProcessEnv = process.env): number | null {
  if (env["NODE_ENV"] !== "test") {
    return null
  }
  const limit = Number(env[TEST_SAMPLE_LIMIT_ENV])
  return Number.isInteger(limit) && limit > 0 ? limit : null
}

/** A set as a run loads it: whole, or cut for a test run (`testSampleLimit`). */
export function cutSampleSet(samples: SampleCatalog, limit: number | null): SampleCatalog {
  if (limit === null) {
    return samples
  }
  return {
    ...samples,
    products: samples.products
      .slice(0, limit)
      .map((product) => ({ ...product, images: product.images.slice(0, 1) })),
  }
}

/** The sample set of a pack, as this run loads, counts and offers it; undefined for none. */
export function sampleSetOf(pack: string): SampleCatalog | undefined {
  const samples = sectorPack(pack)?.samples
  return samples ? cutSampleSet(samples, testSampleLimit()) : undefined
}
