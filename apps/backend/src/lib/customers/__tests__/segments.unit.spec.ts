import { inSegment, needsOrders, segmentRules } from "../segments"
import type { CustomerFacts } from "../segments"

const now = new Date("2026-10-28T12:00:00Z")
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
const facts = (more: Partial<CustomerFacts> = {}): CustomerFacts => ({
  id: "cus_1",
  hasAccount: true,
  spent: 150_000,
  orders: 3,
  lastOrderAt: daysAgo(10),
  emailConsent: true,
  ...more,
})

/** F10.3 (adr/0037 §6): a customer is in a segment when every rule given holds. */
describe("customer segments", () => {
  it("takes a customer every rule fits", () => {
    expect(
      inSegment(
        { min_total_spent: 100_000, min_orders: 2, ordered_within_days: 30, registered: true },
        facts(),
        now
      )
    ).toBe(true)
  })

  it("leaves out a customer one rule does not fit", () => {
    expect(inSegment({ min_total_spent: 200_000 }, facts(), now)).toBe(false)
    expect(inSegment({ min_orders: 4 }, facts(), now)).toBe(false)
    expect(inSegment({ ordered_within_days: 7 }, facts(), now)).toBe(false)
    expect(inSegment({ email_consent: true }, facts({ emailConsent: false }), now)).toBe(false)
    expect(inSegment({ registered: false }, facts(), now)).toBe(false)
  })

  it("finds the ones to win back: ordered before, not lately; never-buyers are not lapsed", () => {
    expect(inSegment({ not_ordered_for_days: 90 }, facts({ lastOrderAt: daysAgo(120) }), now)).toBe(
      true
    )
    expect(inSegment({ not_ordered_for_days: 90 }, facts(), now)).toBe(false)
    expect(
      inSegment({ not_ordered_for_days: 90 }, facts({ lastOrderAt: null, orders: 0 }), now)
    ).toBe(false)
  })

  it("refuses no rule at all, an unknown one, or money that is not whole kuruş", () => {
    expect(segmentRules.safeParse({}).success).toBe(false)
    expect(segmentRules.safeParse({ city: "İstanbul" }).success).toBe(false)
    expect(segmentRules.safeParse({ min_total_spent: 10.5 }).success).toBe(false)
    expect(segmentRules.safeParse({ registered: true }).success).toBe(true)
  })

  it("reads orders only for rules about them", () => {
    expect(needsOrders({ registered: true, email_consent: true })).toBe(false)
    expect(needsOrders({ min_orders: 1 })).toBe(true)
  })
})
