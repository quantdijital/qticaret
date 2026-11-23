import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CATALOG_COLLECTIONS, featureDefinition } from "../../../modules/platform-settings/features"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import { SEO_SITEMAPS_MODULE } from "../../../modules/seo-sitemaps"
import { LIVE_RECORDS, kindEnabled } from "../../seo/live-records"
import { CATALOG_ENTITY_TYPES } from "../entity-paths"
import { collectionsOn, forgetCollectionPages } from "../collections-flag"

const containerWith = (enabled: boolean) => {
  const isFeatureEnabled = jest.fn((key: string) =>
    Promise.resolve(key === CATALOG_COLLECTIONS && enabled)
  )
  const invalidateResolutions = jest.fn(() => Promise.resolve())
  const markDirty = jest.fn(() => Promise.resolve())
  const services: Record<string, unknown> = {
    [PLATFORM_SETTINGS_MODULE]: { isFeatureEnabled },
    [SEO_REDIRECTS_MODULE]: { invalidateResolutions },
    [SEO_SITEMAPS_MODULE]: { markDirty },
  }
  return {
    container: { resolve: (key: string) => services[key] } as never,
    isFeatureEnabled,
    invalidateResolutions,
    markDirty,
  }
}

describe("catalog.collections", () => {
  it("is a tenant flag, on by default so existing shops keep their collections", () => {
    expect(featureDefinition(CATALOG_COLLECTIONS)).toMatchObject({
      default: true,
      owner: "tenant",
    })
  })

  it.each([true, false])("reads the shop's flag (%s)", async (enabled) => {
    const { container, isFeatureEnabled } = containerWith(enabled)

    await expect(collectionsOn(container)).resolves.toBe(enabled)
    expect(isFeatureEnabled).toHaveBeenCalledWith(CATALOG_COLLECTIONS)
  })

  it("forgets cached resolve answers and marks the sitemap for a rebuild", async () => {
    const { container, invalidateResolutions, markDirty } = containerWith(false)

    await forgetCollectionPages(container)

    expect(invalidateResolutions).toHaveBeenCalledTimes(1)
    expect(markDirty).toHaveBeenCalledTimes(1)
  })

  it("switches only the collections' live records with the flag", async () => {
    const off = containerWith(false).container
    const on = containerWith(true).container
    const collections = LIVE_RECORDS.find((spec) => spec.type === CATALOG_ENTITY_TYPES.collection)
    const products = LIVE_RECORDS.find((spec) => spec.type === CATALOG_ENTITY_TYPES.product)
    if (!collections || !products) {
      throw new Error("live record specs missing")
    }

    await expect(kindEnabled(off, collections)).resolves.toBe(false)
    await expect(kindEnabled(on, collections)).resolves.toBe(true)
    await expect(kindEnabled(off, products)).resolves.toBe(true)
  })
})
