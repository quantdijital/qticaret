import { createMemoryStore } from "../../../security/rate-limit"
import { SMS_LIMITS, smsAllowance } from "../quota"

describe("SMS quotas (F9.8)", () => {
  it("refuses a number past its hour, and lets another through", async () => {
    const store = createMemoryStore()
    const send = (numberKey: string) => smsAllowance(store, { numberKey, dailyLimit: 1000 })
    const results = []
    for (let i = 0; i <= SMS_LIMITS.perNumberHour; i += 1) {
      results.push(await send("a"))
    }

    expect(results.slice(0, -1).every(({ allowed }) => allowed)).toBe(true)
    expect(results.at(-1)).toMatchObject({ allowed: false, reason: "number" })
    expect(await send("b")).toMatchObject({ allowed: true })
  })

  it("stops the shop at its daily limit, warning once at 80%", async () => {
    const store = createMemoryStore()
    const results = []
    for (let i = 0; i < 6; i += 1) {
      results.push(await smsAllowance(store, { numberKey: `n${String(i)}`, dailyLimit: 5 }))
    }

    expect(results.map(({ warn }) => warn)).toEqual([false, false, false, true, false, false])
    expect(results.map(({ allowed }) => allowed)).toEqual([true, true, true, true, true, false])
    expect(results.at(-1)).toMatchObject({ reason: "shop" })
  })

  it("asks a visitor who keeps asking for a challenge, then refuses them", async () => {
    const store = createMemoryStore()
    const results = []
    for (let i = 0; i <= SMS_LIMITS.perIpHour; i += 1) {
      results.push(
        await smsAllowance(store, {
          numberKey: `n${String(i)}`,
          dailyLimit: 1000,
          ipBucket: "203.0.113.0",
        })
      )
    }

    expect(results.map(({ challenge }) => challenge).indexOf(true)).toBe(SMS_LIMITS.perIpChallenge)
    expect(results.at(-1)).toMatchObject({ allowed: false, reason: "ip" })
  })
})
