import { chargeTally } from "../charge-tally"
import { usageCredits } from "../steps/record-usage"

/** adr/0085 §3 (P4b-2): a run's charges as the gateway's headers said, for its usage rows. */
describe("charge tally", () => {
  it("names each call's charge in the order told, null past them", () => {
    const tally = chargeTally()
    expect([tally.at(0), tally.total()]).toEqual([null, null])

    tally.onCharge({ credits: 2, balance: 38 })
    tally.onCharge({ credits: 0, balance: 38 })

    expect([tally.at(0), tally.at(1), tally.at(2)]).toEqual([2, 0, null])
    expect(tally.total()).toBe(2)
  })

  it("writes credits on the platform's rows only", () => {
    expect(usageCredits("platform_credit", 3)).toBe(3)
    expect(usageCredits("platform_credit", 0)).toBe(0)
    expect(usageCredits("platform_credit", undefined)).toBeNull()
    // The shop's own key: never a credit, whatever a call carried
    expect(usageCredits("own_key", 3)).toBeNull()
    expect(usageCredits("own_key", null)).toBeNull()
  })
})
