import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { indexedPrices } from "../../search/prices"
import { sellingPrices } from "../selling-prices"

jest.mock("../sale-products", () => ({ productsShown: () => Promise.resolve(new Map()) }))

function container() {
  const graph = jest.fn((config: { entity: string }) =>
    Promise.resolve({
      data: config.entity === "region" ? [{ id: "reg_tr", currency_code: "try" }] : [],
    })
  )
  const scope = {
    resolve: (key: string) => (key === ContainerRegistrationKeys.QUERY ? { graph } : undefined),
  } as unknown as MedusaContainer
  return { scope, graph }
}

/** Every pricing context a reader asked Medusa with, as text. */
const contexts = (graph: jest.Mock) =>
  graph.mock.calls.map(([config]) =>
    JSON.stringify((config as { context?: unknown }).context ?? {})
  )

/**
 * ADR-0068 §7: the public price readers (the price display and its
 * history, the search index) price without a customer, so a wholesale
 * list can never reach a public answer, whoever's key asked.
 */
describe("the public price readers", () => {
  it("read the selling price with the currency alone", async () => {
    const { scope, graph } = container()
    await sellingPrices(scope, ["variant_a"], "try")
    expect(contexts(graph)).toHaveLength(1)
    for (const context of contexts(graph)) {
      expect(context).not.toMatch(/customer|group/)
    }
  })

  it("index each region's price with no customer either", async () => {
    const { scope, graph } = container()
    await indexedPrices(scope, [{ id: "prod_a", published: true, variant_ids: ["variant_a"] }])
    const priced = contexts(graph)
    // The regions' read, then each region's prices with their context
    expect(priced.some((context) => context.includes("currency_code"))).toBe(true)
    for (const context of priced) {
      expect(context).not.toMatch(/customer|group/)
    }
  })
})
