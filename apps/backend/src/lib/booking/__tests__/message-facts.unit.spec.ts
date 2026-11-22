import { departureTime, reminderDue, termLines } from "../message-facts"
import type { ReminderFacts } from "../message-facts"

const DAY = 24 * 60 * 60 * 1000
const STARTS = new Date("2027-05-12T05:30:00.000Z")

const facts = (overrides: Partial<ReminderFacts> = {}): ReminderFacts => ({
  starts_at: STARTS,
  booked_at: new Date(STARTS.getTime() - 20 * DAY),
  reminder_days: 2,
  cancelled: false,
  reminded: false,
  ...overrides,
})

describe("which departures are reminded (adr/0076 Ek D7b)", () => {
  it("is due once its days before the departure have come, until it starts", () => {
    expect(reminderDue(facts(), new Date(STARTS.getTime() - 3 * DAY))).toBe(false)
    expect(reminderDue(facts(), new Date(STARTS.getTime() - 2 * DAY))).toBe(true)
    expect(reminderDue(facts(), new Date(STARTS.getTime() - 60_000))).toBe(true)
    expect(reminderDue(facts(), STARTS)).toBe(false)
  })

  it("never goes to a cancelled departure, twice, or with the reminder off", () => {
    const now = new Date(STARTS.getTime() - DAY)
    expect(reminderDue(facts({ cancelled: true }), now)).toBe(false)
    expect(reminderDue(facts({ reminded: true }), now)).toBe(false)
    expect(reminderDue(facts({ reminder_days: 0 }), now)).toBe(false)
  })

  it("skips a booking made inside the window: its confirmation has just gone", () => {
    const now = new Date(STARTS.getTime() - DAY)
    expect(reminderDue(facts({ booked_at: new Date(STARTS.getTime() - DAY - 1000) }), now)).toBe(
      false
    )
  })
})

describe("the terms a booking's messages show", () => {
  it("lists the tiers as sold, farthest first", () => {
    expect(
      termLines(
        [
          { days_before: 0, fee_percent: 100 },
          { days_before: 7, fee_percent: 50 },
        ],
        false
      )
    ).toEqual([
      { days_before: 7, fee_percent: 50 },
      { days_before: 0, fee_percent: 100 },
    ])
  })

  it("shows the package travel floor: 30 days or more keep nothing, said even with no tier", () => {
    expect(termLines([{ days_before: 45, fee_percent: 20 }], true)).toEqual([
      { days_before: 45, fee_percent: 0 },
    ])
    expect(termLines([], true)).toEqual([{ days_before: 30, fee_percent: 0 }])
    expect(termLines(null, false)).toEqual([])
  })

  it("writes the departure in the product's zone", () => {
    expect(departureTime(STARTS, "Europe/Istanbul")).toContain("08:30")
    expect(departureTime(STARTS, "UTC")).toContain("05:30")
  })
})
