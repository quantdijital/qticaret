import { describe, expect, it } from "vitest"
import { milestones } from "./order-math"

const AT = "2026-10-20T10:00:00.000Z"
const LATER = "2026-10-21T10:00:00.000Z"

describe("milestones", () => {
  it("dates each step from the records, the last delivery for a delivered order", () => {
    const order = {
      created_at: AT,
      payment_collections: [{ payments: [{ captured_at: AT }] }],
      fulfillments: [
        { shipped_at: AT, delivered_at: AT },
        { shipped_at: LATER, delivered_at: LATER },
        { shipped_at: AT, canceled_at: AT },
      ],
    }

    expect(milestones(order, "delivered")).toEqual({
      placed: AT,
      paid: AT,
      shipped: AT,
      delivered: LATER,
    })
  })

  it("dates a held payment from the order once the server says it can ship, and nothing before", () => {
    const order = { created_at: AT, payment_collections: [{ payments: [{ captured_at: null }] }] }

    expect(milestones(order, "to_ship")).toMatchObject({ paid: AT, shipped: null, delivered: null })
    expect(milestones(order, "awaiting_payment").paid).toBeNull()
  })
})
