import { CONTENT_AI_DRAFTS } from "../../../../modules/platform-settings/features"
import { listedFeatures } from "../listed"

const FLAGS = [
  { key: "catalog.non_physical" },
  { key: CONTENT_AI_DRAFTS },
  { key: "stock.preorder" },
]

describe("the feature flags the panel lists", () => {
  it("leaves the AI drafts out while no draft provider is set", () => {
    expect(listedFeatures(FLAGS, { contentDrafts: false }).map(({ key }) => key)).toEqual([
      "catalog.non_physical",
      "stock.preorder",
    ])
  })

  it("lists them once a provider is set", () => {
    expect(listedFeatures(FLAGS, { contentDrafts: true })).toEqual(FLAGS)
  })
})
