import type { WalletRow } from "../../../modules/ai-credits/service-wallet"
import { walletIsCurrent } from "../balance"

/**
 * PR #371 D2: the status reads a wallet without a lock only when the
 * locked way would change nothing; these are `touch`'s own two tests.
 */
describe("walletIsCurrent", () => {
  const now = new Date("2026-11-10T09:00:00.000Z")
  const wallet = (change: Partial<WalletRow> = {}): WalletRow => ({
    plan_balance: 10,
    plan_period: "2026-11",
    purchased_balance: 0,
    purchased_expires_at: null,
    daily_cap: null,
    spent_today: 0,
    spent_day: null,
    ...change,
  })

  it("reads as is a wallet of this month with nothing past its day", () => {
    expect(walletIsCurrent(wallet(), now)).toBe(true)
    expect(walletIsCurrent(wallet({ plan_period: "2026-12" }), now)).toBe(true)
    expect(
      walletIsCurrent(
        wallet({ purchased_balance: 5, purchased_expires_at: new Date(now.getTime() + 1) }),
        now
      )
    ).toBe(true)
    // Nothing left to expire: the locked way would write nothing either
    expect(walletIsCurrent(wallet({ purchased_expires_at: new Date(0) }), now)).toBe(true)
  })

  it("leaves to the locked way a month behind and bought credits past their day", () => {
    expect(walletIsCurrent(wallet({ plan_period: null }), now)).toBe(false)
    expect(walletIsCurrent(wallet({ plan_period: "2026-10" }), now)).toBe(false)
    // Istanbul's month: 2026-11-30T21:00Z is already December there
    expect(walletIsCurrent(wallet(), new Date("2026-11-30T21:00:00.000Z"))).toBe(false)
    for (const at of [now, new Date(now.getTime() - 1)]) {
      expect(walletIsCurrent(wallet({ purchased_balance: 5, purchased_expires_at: at }), now)).toBe(
        false
      )
    }
  })
})
