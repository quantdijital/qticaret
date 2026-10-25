import { checkoutProblem } from "../rules"

const address = { country_code: "tr" }

describe("checkoutProblem", () => {
  it("asks for a shipping country, which KDV is worked out from", () => {
    expect(checkoutProblem({ items: [{ requires_shipping: false }] })).toMatchObject({
      key: "cart.address_required",
    })
    expect(checkoutProblem({ shipping_address: { country_code: null } })).toMatchObject({
      key: "cart.address_required",
    })
  })

  it("refuses a shipping method on a cart with nothing to ship", () => {
    expect(
      checkoutProblem({
        shipping_address: address,
        items: [{ requires_shipping: false }],
        shipping_methods: [{ id: "sm_1" }],
      })
    ).toMatchObject({ key: "cart.shipping_not_needed" })
  })

  it("lets a digital cart without a method and a mixed cart with one through", () => {
    expect(
      checkoutProblem({
        shipping_address: address,
        items: [{ requires_shipping: false }],
        shipping_methods: [],
      })
    ).toBeNull()
    expect(
      checkoutProblem({
        shipping_address: address,
        items: [{ requires_shipping: false }, { requires_shipping: true }],
        shipping_methods: [{ id: "sm_1" }],
      })
    ).toBeNull()
  })
})
