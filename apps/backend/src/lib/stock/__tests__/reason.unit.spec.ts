import { reasonOf } from "../reason"

describe("why a stock level moved (adr/0020)", () => {
  it.each([
    [-1, -1, false, "order"],
    [0, 2, false, "order"],
    [0, -1, false, "cancel"],
    [1, 0, true, "return"],
    [-1, 0, true, "order"],
    [5, 0, false, "manual"],
    [-3, 0, false, "manual"],
  ] as const)("shelf %p, holds %p, order %p → %s", (stocked, reserved, hasOrder, reason) => {
    expect(reasonOf(stocked, reserved, hasOrder)).toBe(reason)
  })
})
