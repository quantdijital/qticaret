import { BACKORDER_CLAIMS } from "../backorder-gate"

const claimsOf = (matcher: string) => {
  const read = BACKORDER_CLAIMS[matcher]
  if (!read) {
    throw new Error(`no rule for ${matcher}`)
  }
  return read
}

const NONE = { created: false, updated: [] }

describe("BACKORDER_CLAIMS", () => {
  it("reads a new product's variants as made", () => {
    const read = claimsOf("/admin/products")
    expect(read({ variants: [{ allow_backorder: false }, { allow_backorder: true }] }, {})).toEqual(
      { created: true, updated: [] }
    )
    expect(read({ variants: [{ allow_backorder: "true" }] }, {})).toEqual(NONE)
  })

  it("tells a product update's changed variants from its new ones", () => {
    const read = claimsOf("/admin/products/:id")
    expect(
      read(
        { variants: [{ id: "variant_1", allow_backorder: true }, { allow_backorder: true }] },
        { id: "prod_1" }
      )
    ).toEqual({ created: true, updated: ["variant_1"] })
    // The batch route has its own rule
    expect(
      read({ update: [{ variants: [{ id: "v", allow_backorder: true }] }] }, { id: "BATCH" })
    ).toEqual(NONE)
  })

  it("reads both halves of a product batch", () => {
    const read = claimsOf("/admin/products/batch")
    expect(
      read(
        {
          create: [{ variants: [{ allow_backorder: true }] }],
          update: [{ id: "prod_1", variants: [{ id: "variant_1", allow_backorder: true }] }],
        },
        {}
      )
    ).toEqual({ created: true, updated: ["variant_1"] })
  })

  it("reads a variant batch, and a single variant by its route", () => {
    expect(
      claimsOf("/admin/products/:id/variants/batch")(
        {
          create: [{ allow_backorder: false }],
          update: [{ id: "variant_1", allow_backorder: true }],
        },
        {}
      )
    ).toEqual({ created: false, updated: ["variant_1"] })
    const single = claimsOf("/admin/products/:id/variants/:variant_id")
    expect(single({ allow_backorder: true }, { variant_id: "variant_1" })).toEqual({
      created: false,
      updated: ["variant_1"],
    })
    expect(single({ allow_backorder: true }, { variant_id: "batch" })).toEqual(NONE)
  })

  it("finds no claim in a body that is not an object", () => {
    for (const read of Object.values(BACKORDER_CLAIMS)) {
      expect(read(null, {})).toEqual(NONE)
      expect(read([{ allow_backorder: true }], {})).toEqual(NONE)
    }
  })
})
