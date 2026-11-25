import { callsInFlight, holdCallSlot, resetCallSlots } from "../in-flight"
import { AI_GATEWAY_MAX_IN_FLIGHT, AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP } from "../limits"

describe("the gateway's calls in flight (P3b review O2)", () => {
  afterEach(() => {
    resetCallSlots()
  })

  it("holds a shop to its four, others still served", () => {
    const held = Array.from({ length: AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP }, () =>
      holdCallSlot("ten_a")
    )
    expect(held.every((slot) => slot !== null)).toBe(true)
    expect(holdCallSlot("ten_a")).toBeNull()
    expect(holdCallSlot("ten_b")).not.toBeNull()
    held[0]?.()
    expect(callsInFlight("ten_a")).toBe(AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP - 1)
    expect(holdCallSlot("ten_a")).not.toBeNull()
  })

  it("gives a slot back once, however often it is given", () => {
    const slot = holdCallSlot("ten_a")
    slot?.()
    slot?.()
    expect([callsInFlight(), callsInFlight("ten_a")]).toEqual([0, 0])
  })

  it("holds the process to its 32 across shops", () => {
    const slots = Array.from({ length: AI_GATEWAY_MAX_IN_FLIGHT }, (_, index) =>
      holdCallSlot(`ten_${String(index)}`)
    )
    expect(slots.every((slot) => slot !== null)).toBe(true)
    expect(holdCallSlot("ten_new")).toBeNull()
    slots[5]?.()
    expect(holdCallSlot("ten_new")).not.toBeNull()
    expect(callsInFlight()).toBe(AI_GATEWAY_MAX_IN_FLIGHT)
  })
})
