import { refusalOf, restrictionsOf } from "../restrictions"

const rule = (attribute: string, values: string[]) => ({
  attribute,
  values: values.map((value) => ({ value })),
})

describe("promotion restrictions (K1/K2)", () => {
  it("reads customer groups and first order only from a promotion's rules", () => {
    expect(restrictionsOf(null)).toEqual({ groups: null, firstOrder: false })
    expect(
      restrictionsOf([
        rule("item_total", ["150"]),
        rule("customer.groups.id", ["g1", "g2"]),
        rule("first_order", ["true"]),
      ])
    ).toEqual({ groups: ["g1", "g2"], firstOrder: true })
    // A first-order rule for anything but "true" restricts nothing
    expect(restrictionsOf([rule("first_order", ["false"])]).firstOrder).toBe(false)
  })

  it("tells a buyer why a code is not theirs", () => {
    const groups = { groups: ["g1"], firstOrder: false }
    expect(refusalOf(groups, { groupIds: null, placedBefore: null })).toBe(
      "promotions.customer_group_login"
    )
    expect(refusalOf(groups, { groupIds: ["g2"], placedBefore: null })).toBe(
      "promotions.customer_group_only"
    )
    expect(refusalOf(groups, { groupIds: ["g2", "g1"], placedBefore: true })).toBeNull()

    const first = { groups: null, firstOrder: true }
    expect(refusalOf(first, { groupIds: null, placedBefore: true })).toBe(
      "promotions.first_order_only"
    )
    expect(refusalOf(first, { groupIds: null, placedBefore: false })).toBeNull()
    // Not known yet (a guest before the e-mail): the checkout decides
    expect(refusalOf(first, { groupIds: null, placedBefore: null })).toBeNull()
  })
})
