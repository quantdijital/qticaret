import { Modules } from "@medusajs/framework/utils"
import { shippingChanges } from "../shipping-kind"

const product = (profile: string | null, items: [string, boolean][]) => ({
  id: "prod_1",
  shipping_profile: profile ? { id: profile } : null,
  variants: [
    {
      inventory_items: items.map(([id, requires]) => ({
        inventory_item_id: id,
        inventory: { requires_shipping: requires },
      })),
    },
  ],
})

const link = (profile: string) => ({
  [Modules.PRODUCT]: { product_id: "prod_1" },
  [Modules.FULFILLMENT]: { shipping_profile_id: profile },
})

describe("shippingChanges", () => {
  it("takes a digital product off shipping: no profile, items need none", () => {
    expect(
      shippingChanges(
        product("sp_default", [
          ["iitem_1", true],
          ["iitem_2", true],
        ]),
        "digital",
        "sp_default"
      )
    ).toEqual({
      dismiss: [link("sp_default")],
      link: [],
      inventory: [
        { id: "iitem_1", requires_shipping: false },
        { id: "iitem_2", requires_shipping: false },
      ],
    })
  })

  it("puts a physical product back on the default profile with shipping items", () => {
    expect(shippingChanges(product(null, [["iitem_1", false]]), "physical", "sp_default")).toEqual({
      dismiss: [],
      link: [link("sp_default")],
      inventory: [{ id: "iitem_1", requires_shipping: true }],
    })
  })

  it("changes nothing that already fits the kind", () => {
    expect(shippingChanges(product("sp_x", [["iitem_1", true]]), "physical", "sp_default")).toEqual(
      {
        dismiss: [],
        link: [],
        inventory: [],
      }
    )
    expect(shippingChanges(product(null, [["iitem_1", false]]), "service", null).inventory).toEqual(
      []
    )
  })
})
