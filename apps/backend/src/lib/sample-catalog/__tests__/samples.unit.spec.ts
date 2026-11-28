import { sectorPack } from "@qticaret/sector-packs"
import { TEST_SAMPLE_LIMIT_ENV, cutSampleSet, testSampleLimit } from "../samples"

/** A test run loads a cut set; a shop never does. */
describe("the sample set a run loads", () => {
  const travel = sectorPack("travel")?.samples
  if (!travel) {
    throw new Error("the travel pack has no samples")
  }

  it("is cut only under NODE_ENV=test, and only to a whole positive count", () => {
    expect(testSampleLimit({ NODE_ENV: "test", [TEST_SAMPLE_LIMIT_ENV]: "2" })).toBe(2)
    expect(testSampleLimit({ NODE_ENV: "production", [TEST_SAMPLE_LIMIT_ENV]: "2" })).toBeNull()
    expect(testSampleLimit({ [TEST_SAMPLE_LIMIT_ENV]: "2" })).toBeNull()
    expect(testSampleLimit({ NODE_ENV: "test" })).toBeNull()
    expect(testSampleLimit({ NODE_ENV: "test", [TEST_SAMPLE_LIMIT_ENV]: "0" })).toBeNull()
    expect(testSampleLimit({ NODE_ENV: "test", [TEST_SAMPLE_LIMIT_ENV]: "x" })).toBeNull()
  })

  it("keeps its first products with one picture each, the rest of the set as it is", () => {
    const cut = cutSampleSet(travel, 2)
    expect(cut.products.map((product) => product.handle)).toEqual(
      travel.products.slice(0, 2).map((product) => product.handle)
    )
    expect(cut.products.every((product) => product.images.length === 1)).toBe(true)
    expect(cut.categories).toBe(travel.categories)
    expect(cutSampleSet(travel, null)).toBe(travel)
  })

  it("still makes a sample category in the cut set the integration test reads", () => {
    const cut = cutSampleSet(travel, 2)
    expect(
      cut.products.some((product) => product.categories.includes("ege-ve-akdeniz-turlari"))
    ).toBe(true)
    expect(cut.products.every((product) => product.reviews.length > 0 && product.booking)).toBe(
      true
    )
  })
})
