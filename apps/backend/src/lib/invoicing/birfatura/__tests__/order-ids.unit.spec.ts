import { birfaturaOrderId, saleRefOf } from "../order-ids"

describe("BirFatura's OrderId for a sale invoice (adr/0072 §5)", () => {
  it("is the order's number for its first sale", () => {
    expect(birfaturaOrderId({ display_id: 1042, exchange: 0 })).toEqual({ id: 1042, code: "1042" })
    expect(saleRefOf(1042)).toEqual({ display_id: 1042, exchange: 0 })
  })

  it("gives an exchange's sale an id of its own that never meets a first sale's", () => {
    const first = birfaturaOrderId({ display_id: 12, exchange: 1 })
    const second = birfaturaOrderId({ display_id: 12, exchange: 2 })

    expect(first).toEqual({ id: 1_000_000_001_201, code: "12-D1" })
    expect(second?.id).toBe(1_000_000_001_202)
    // Order 1201's first sale is not order 12's exchange
    expect(birfaturaOrderId({ display_id: 1201, exchange: 0 })?.id).not.toBe(first?.id)
    expect(saleRefOf(first?.id ?? 0)).toEqual({ display_id: 12, exchange: 1 })
  })

  it("refuses an id it could not give back", () => {
    expect(birfaturaOrderId({ display_id: 0, exchange: 0 })).toBeNull()
    expect(birfaturaOrderId({ display_id: 5, exchange: 100 })).toBeNull()
    expect(saleRefOf(0)).toBeNull()
    expect(saleRefOf(-4)).toBeNull()
    expect(saleRefOf(1.5)).toBeNull()
    // The exchange range with no exchange in it
    expect(saleRefOf(1_000_000_001_200)).toBeNull()
  })
})
