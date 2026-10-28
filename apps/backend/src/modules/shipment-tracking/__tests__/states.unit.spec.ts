import { isFinal, movesOn, withCarrier } from "../states"

describe("a parcel's way (adr/0031)", () => {
  it("moves forward only, and never out of an end", () => {
    expect(movesOn("created", "in_transit")).toBe(true)
    expect(movesOn("in_transit", "delivered")).toBe(true)
    expect(movesOn("in_transit", "created")).toBe(false)
    expect(movesOn("in_transit", "in_transit")).toBe(false)
    expect(movesOn("delivered", "returned")).toBe(false)
    expect(movesOn("in_transit", "returned")).toBe(true)
    expect(isFinal("canceled")).toBe(true)
    expect(isFinal("out_for_delivery")).toBe(false)
  })

  it("counts the parcel with the carrier from the pickup to the door", () => {
    expect(withCarrier("created")).toBe(false)
    expect(withCarrier("picked_up")).toBe(true)
    expect(withCarrier("delivered")).toBe(true)
    expect(withCarrier("returned")).toBe(false)
  })
})
