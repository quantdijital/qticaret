import { WEBHOOK_EVENTS_MODULE } from "../../../modules/webhook-events"
import type { IyzicoCheck } from "../steps/iyzico-callback"
import { iyzicoTakeKey, withIyzicoTakes } from "../steps/iyzico-takes"

const SESSION = "payses_01JABCDEFGHJKMNPQRSTVWXYZ0"

const paid: IyzicoCheck = {
  outcome: "paid",
  verdict: {
    kind: "complete",
    cart_id: "cart_01",
    amount: 21000,
    currency_code: "try",
    test_mode: true,
    provider: "iyzico",
    reference: "28400000",
    session_id: SESSION,
  },
  payment_id: "28400000",
}

function containerCounting(countTake: jest.Mock) {
  const resolve = jest.fn((key: string) => {
    if (key !== WEBHOOK_EVENTS_MODULE) {
      throw new Error(`unexpected ${key}`)
    }
    return { countTake }
  })
  return { resolve } as never
}

describe("iyzico's paid form carries its takes, as PayTR's notice does (PR #137 review)", () => {
  it("counts the take on the form's own record and puts it on the verdict", async () => {
    const countTake = jest.fn().mockResolvedValue(5)

    const check = await withIyzicoTakes(containerCounting(countTake), paid)

    expect(countTake).toHaveBeenCalledWith("iyzico", `${SESSION}:paid`)
    expect(iyzicoTakeKey(SESSION)).toBe(`${SESSION}:paid`)
    expect(check).toEqual({ ...paid, verdict: { ...paid.verdict, attempts: 5 } })
  })

  it("counts nothing for a verdict that completes nothing", async () => {
    const countTake = jest.fn()
    const skipped: IyzicoCheck = { outcome: "failed", verdict: { kind: "skip" }, payment_id: null }

    expect(await withIyzicoTakes(containerCounting(countTake), skipped)).toBe(skipped)
    expect(countTake).not.toHaveBeenCalled()
  })

  it("never stops the order when the count cannot be kept: the verdict goes on uncounted", async () => {
    const countTake = jest.fn().mockRejectedValue(new Error("connection reset"))

    expect(await withIyzicoTakes(containerCounting(countTake), paid)).toBe(paid)
  })
})
