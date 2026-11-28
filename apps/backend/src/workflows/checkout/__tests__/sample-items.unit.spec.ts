import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { refuseSampleItems } from "../sample-items"

/**
 * A sample product is never sold (owner, 2026-11-28): the add-to-cart and
 * cart-creation hooks refuse its variant on the server, whatever the
 * storefront sends; a copy of a sample (another id under the same mark)
 * is the shop's own and sells.
 */

const mark = (of: string) => ({ sample: "travel@1", sample_of: of, sample_at: "2026-11-28" })

function containerWith(rows: unknown[]) {
  const graph = jest.fn().mockResolvedValue({ data: rows })
  const container = {
    resolve: (key: string) => {
      if (key !== ContainerRegistrationKeys.QUERY) {
        throw new Error(`unexpected ${key}`)
      }
      return { graph }
    },
  }
  return { container, graph }
}

describe("refuseSampleItems", () => {
  it("refuses a sample product's variant", async () => {
    const { container, graph } = containerWith([
      { id: "variant_1", product: { id: "prod_1", metadata: mark("prod_1") } },
    ])
    await expect(refuseSampleItems(container, [{ variant_id: "variant_1" }])).rejects.toMatchObject(
      { safeMessage: "sample_catalog.not_for_sale", field: "variant_id" }
    )
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "product_variant", filters: { id: ["variant_1"] } })
    )
  })

  it("lets the shop's own product and a copy of a sample through", async () => {
    const { container } = containerWith([
      { id: "variant_1", product: { id: "prod_1", metadata: null } },
      { id: "variant_2", product: { id: "prod_copy", metadata: mark("prod_1") } },
    ])
    await expect(
      refuseSampleItems(container, [{ variant_id: "variant_1" }, { variant_id: "variant_2" }])
    ).resolves.toBeUndefined()
  })

  it("reads nothing for lines without a variant (a fee line)", async () => {
    const { container, graph } = containerWith([])
    await refuseSampleItems(container, [{ variant_id: null }, {}])
    await refuseSampleItems(container, undefined)
    expect(graph).not.toHaveBeenCalled()
  })
})
