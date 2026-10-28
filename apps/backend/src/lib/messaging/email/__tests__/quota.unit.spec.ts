import { createMemoryStore } from "../../../security/rate-limit"
import { emailAllowance } from "../quota"

describe("e-mail quota (F10 M9)", () => {
  it("stops the shop at its daily limit, warning once at 80%", async () => {
    const store = createMemoryStore()
    const results = []
    for (let i = 0; i < 6; i += 1) {
      results.push(await emailAllowance(store, { dailyLimit: 5 }))
    }

    expect(results.map(({ warn }) => warn)).toEqual([false, false, false, true, false, false])
    expect(results.map(({ allowed }) => allowed)).toEqual([true, true, true, true, true, false])
  })

  it("starts each day afresh", async () => {
    const store = createMemoryStore()
    const today = new Date("2026-10-28T10:00:00Z")
    const tomorrow = new Date("2026-10-29T10:00:00Z")
    await emailAllowance(store, { dailyLimit: 1, now: today })
    const again = await emailAllowance(store, { dailyLimit: 1, now: today })
    const next = await emailAllowance(store, { dailyLimit: 1, now: tomorrow })

    expect(again.allowed).toBe(false)
    expect(next).toMatchObject({ allowed: true, shopToday: 1 })
  })
})
