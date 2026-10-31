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

  it("keeps e-mails anyone can ask for to a quarter of the day, the rest for orders", async () => {
    const store = createMemoryStore()
    const open = []
    for (let i = 0; i < 4; i += 1) {
      open.push(await emailAllowance(store, { dailyLimit: 8, open: true }))
    }
    const order = await emailAllowance(store, { dailyLimit: 8 })

    expect(open.map(({ allowed }) => allowed)).toEqual([true, true, false, false])
    expect(open[2]?.reason).toBe("open")
    // The refused ones took nothing from the day: the order's e-mail is the third
    expect(order).toMatchObject({ allowed: true, shopToday: 3 })
  })

  it("never lets a campaign stop an order's e-mail: each kind has its own day", async () => {
    const store = createMemoryStore()
    const campaign = []
    for (let i = 0; i < 3; i += 1) {
      campaign.push(await emailAllowance(store, { dailyLimit: 2, budget: "commercial" }))
    }
    const order = await emailAllowance(store, { dailyLimit: 2 })

    expect(campaign.map(({ allowed }) => allowed)).toEqual([true, true, false])
    expect(order).toMatchObject({ allowed: true, shopToday: 1 })
  })

  it("keeps a campaign's open e-mails (cart reminders) off the resets' share", async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 3; i += 1) {
      await emailAllowance(store, { dailyLimit: 8, budget: "commercial", open: true })
    }
    const reset = await emailAllowance(store, { dailyLimit: 8, open: true })

    expect(reset.allowed).toBe(true)
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
