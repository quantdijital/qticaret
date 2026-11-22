import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { unneededShippingMethods } from "../unneeded-shipping"

function containerWith(cart: unknown) {
  const graph = jest.fn().mockResolvedValue({ data: cart === undefined ? [] : [cart] })
  return {
    graph,
    container: {
      resolve: (key: string) => (key === ContainerRegistrationKeys.QUERY ? { graph } : undefined),
    } as never,
  }
}

describe("shipping methods a cart no longer needs (adr/0076 Ek D5)", () => {
  it("names every method once only dated or digital lines are left", async () => {
    const { container, graph } = containerWith({
      completed_at: null,
      items: [{ requires_shipping: false }, { requires_shipping: false }],
      shipping_methods: [{ id: "casm_1" }, null, { id: "casm_2" }],
    })
    expect(await unneededShippingMethods(container, "cart_1")).toEqual(["casm_1", "casm_2"])
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "cart", filters: { id: "cart_1" } })
    )
  })

  it("keeps the method while any line ships, or says nothing on the line", async () => {
    for (const items of [
      [{ requires_shipping: false }, { requires_shipping: true }],
      [{ requires_shipping: false }, {}],
      [{ requires_shipping: null }],
    ]) {
      const { container } = containerWith({ items, shipping_methods: [{ id: "casm_1" }] })
      expect(await unneededShippingMethods(container, "cart_1")).toEqual([])
    }
  })

  it("leaves a completed cart, a cart without a method and an unknown cart alone", async () => {
    const completed = containerWith({
      completed_at: "2026-11-22T10:00:00.000Z",
      items: [{ requires_shipping: false }],
      shipping_methods: [{ id: "casm_1" }],
    })
    expect(await unneededShippingMethods(completed.container, "cart_1")).toEqual([])
    const bare = containerWith({ items: [{ requires_shipping: false }], shipping_methods: [] })
    expect(await unneededShippingMethods(bare.container, "cart_1")).toEqual([])
    const unknown = containerWith(undefined)
    expect(await unneededShippingMethods(unknown.container, "cart_x")).toEqual([])
  })
})
