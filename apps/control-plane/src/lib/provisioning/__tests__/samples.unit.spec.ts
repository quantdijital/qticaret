import { sectorPacks } from "@qticaret/sector-packs"
import { loadSamplesResultSchema } from "@qticaret/types/control-plane"
import { sampleProductsOf, sectorPackSummaries } from "../../tenants/sector-packs"
import { fakeSamples, loadFakeSamples } from "../fake-samples"

// Whatever packs this release ships with and without samples: no pack named here
const WITH = sectorPacks().find((pack) => (pack.samples?.products.length ?? 0) > 0)
const WITHOUT = sectorPacks().find((pack) => !pack.samples)

describe("the wizard's sample products", () => {
  it("are offered for a pack by how many products its samples hold", () => {
    if (!WITH || !WITHOUT) {
      throw new Error("@qticaret/sector-packs needs a pack with samples and one without")
    }
    expect(sampleProductsOf(WITH.code)).toBe(WITH.samples?.products.length)
    expect(sampleProductsOf(WITHOUT.code)).toBe(0)
    expect(sampleProductsOf("no-such-pack")).toBe(0)
    const offers = sectorPackSummaries()
    expect(offers.find((pack) => pack.code === WITH.code)?.sample_products).toBeGreaterThan(0)
    expect(offers.find((pack) => pack.code === WITHOUT.code)?.sample_products).toBe(0)
  })

  it("read the shop's answer strictly", () => {
    expect(
      loadSamplesResultSchema.safeParse({
        status: "loaded",
        pack: "x-pack",
        products: 3,
        categories_made: 1,
        categories_opened: 0,
      }).success
    ).toBe(true)
    expect(loadSamplesResultSchema.safeParse({ status: "already_loaded" }).success).toBe(true)
    for (const bad of [
      { status: "loaded", pack: "../x", products: 1, categories_made: 0, categories_opened: 0 },
      { status: "loaded", pack: "x-pack", products: -1, categories_made: 0, categories_opened: 0 },
      { status: "already_loaded", extra: "value" },
      { status: "maybe" },
      null,
    ]) {
      expect(loadSamplesResultSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("load in the tests' shop once, only for a pack it was given", () => {
    if (!WITH || !WITHOUT) {
      throw new Error("@qticaret/sector-packs needs a pack with samples and one without")
    }
    const given = { [WITH.code]: WITH.version, [WITHOUT.code]: WITHOUT.version }
    expect(loadFakeSamples("ten_a", WITH.code, {})).toMatchObject({
      ok: false,
      result: { status: "unknown_samples" },
    })
    expect(loadFakeSamples("ten_a", WITHOUT.code, given)).toMatchObject({
      ok: false,
      result: { status: "unknown_samples" },
    })
    expect(loadFakeSamples("ten_a", WITH.code, given)).toMatchObject({
      ok: true,
      result: { status: "loaded", pack: WITH.code, products: WITH.samples?.products.length },
    })
    expect(loadFakeSamples("ten_a", WITH.code, given)).toMatchObject({
      ok: true,
      result: { status: "already_loaded" },
    })
    expect([...(fakeSamples().get("ten_a") ?? [])]).toEqual([WITH.code])
  })
})
