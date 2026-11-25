import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AI_TASK_CREDITS } from "@qticaret/types/control-plane"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import { grantPurchase } from "../../src/lib/ai-credits/grant"
import { reconcileAiCredits } from "../../src/lib/ai-credits/reconcile"
import { release, spend } from "../../src/lib/ai-credits/spend"
import {
  entriesOf,
  expectLedgerMatchesWallet,
  istanbul,
  opId,
  operationOf,
  pgOf,
  setMonthlyGrant,
  shopId,
  walletOf,
} from "../helpers/ai-credits"

jest.setTimeout(240 * 1000)

// A picture set in a scene: the table's credits, two calls an operation
const TASK = "image_scene"
const COST = AI_TASK_CREDITS[TASK]

/**
 * The credits on the calendar (PR #368 review D6, D7 and its missing
 * tests 7–10): servers whose clocks differ a little, a release after the
 * day or the bought credits' last day passed, a month with no grant, a
 * balance at the integer's end, and the watch that passes over a release
 * that fails.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const call = (tenantId: string, now: Date, operationId = opId()) =>
      spend(c(), { tenantId, operationId, task: TASK, now })
    const buy = (tenantId: string, credits: number, now: Date) =>
      grantPurchase(c(), { tenantId, credits, grantRef: `eft-${opId()}`, actor: "usr_test", now })

    it("D7: a server a little behind counts on the wallet's later day and never resets it", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 400)
      const ahead = istanbul("2026-11-11", "00:05")
      const behind = istanbul("2026-11-10", "23:59")
      await balanceOf(c(), tenantId, ahead)
      await pgOf(c()).raw("UPDATE ai_credit_wallet SET daily_cap = ? WHERE tenant_id = ?", [
        2 * COST,
        tenantId,
      ])
      expect((await call(tenantId, ahead)).kind).toBe("charged")
      expect((await call(tenantId, behind)).kind).toBe("charged")
      expect(await walletOf(c(), tenantId)).toMatchObject({
        spent_day: "2026-11-11",
        spent_today: 2 * COST,
      })
      // The cap holds on both clocks: the counter was not started again
      expect((await call(tenantId, behind)).kind).toBe("daily_cap")
      expect((await call(tenantId, ahead)).kind).toBe("daily_cap")
      expect((await balanceOf(c(), tenantId, behind)).daily).toEqual({
        cap: 2 * COST,
        spent: 2 * COST,
        remaining: 0,
      })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("D7: a wallet already in a later month answers clock_behind, not exhausted, and charges nothing", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 400)
      expect((await call(tenantId, istanbul("2026-12-01", "00:01"))).kind).toBe("charged")
      const wallet = await walletOf(c(), tenantId)
      const entries = await entriesOf(c(), tenantId)
      const operationId = opId()
      expect((await call(tenantId, istanbul("2026-11-30", "23:59"), operationId)).kind).toBe(
        "clock_behind"
      )
      expect(await walletOf(c(), tenantId)).toEqual(wallet)
      expect(await entriesOf(c(), tenantId)).toEqual(entries)
      expect(await operationOf(c(), tenantId, operationId)).toBeUndefined()
    })

    it("(7) a release after the day turned gives the credits back and leaves the new day's counter", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 400)
      const yesterday = opId()
      await call(tenantId, istanbul("2026-11-10", "23:50"), yesterday)
      await call(tenantId, istanbul("2026-11-11", "00:10"))
      expect(await walletOf(c(), tenantId)).toMatchObject({
        spent_day: "2026-11-11",
        spent_today: COST,
      })
      const done = await release(c(), {
        tenantId,
        operationId: yesterday,
        now: istanbul("2026-11-11", "00:20"),
      })
      expect(done).toEqual({ released: true, plan: COST, purchased: 0 })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 400 - COST,
        spent_day: "2026-11-11",
        spent_today: COST,
      })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(8) a release into bought credits past their day puts them back to expire again", async () => {
      const tenantId = shopId()
      // Bought a year ago: they last until 2026-11-10 12:00
      await buy(tenantId, 50, istanbul("2025-11-10", "12:00"))
      const operationId = opId()
      expect((await call(tenantId, istanbul("2026-11-10", "11:55"), operationId)).kind).toBe(
        "charged"
      )
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(50 - COST)
      const done = await release(c(), {
        tenantId,
        operationId,
        now: istanbul("2026-11-10", "12:05"),
      })
      expect(done).toEqual({ released: true, plan: 0, purchased: COST })
      // Given back to the bucket they came from, whose day has passed
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(COST)
      await expectLedgerMatchesWallet(c(), tenantId)

      const after = await balanceOf(c(), tenantId, istanbul("2026-11-10", "12:06"))
      expect(after.purchased.balance).toBe(0)
      const bought = (await entriesOf(c(), tenantId)).filter((each) => each.bucket === "purchased")
      expect(bought.map((each) => [each.kind, each.amount])).toEqual([
        ["grant_purchase", 50],
        ["spend", -COST],
        ["expire", -(50 - COST)],
        ["release", COST],
        ["expire", -COST],
      ])
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(9) a month with no grant writes no grant row; a balance at the integer's end refuses, unchanged", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 10)
      await balanceOf(c(), tenantId, istanbul("2026-10-20"))
      await setMonthlyGrant(c(), tenantId, 0)
      const november = await balanceOf(c(), tenantId, istanbul("2026-11-10"))
      expect(november.plan).toMatchObject({ balance: 0, period: "2026-11" })
      await balanceOf(c(), tenantId, istanbul("2026-12-10"))
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_period: "2026-12",
        plan_balance: 0,
      })
      expect((await entriesOf(c(), tenantId)).map((each) => [each.kind, each.amount])).toEqual([
        ["grant_plan_monthly", 10],
        ["expire", -10],
      ])

      await buy(tenantId, 10, istanbul("2026-12-10"))
      await pgOf(c()).raw(
        "UPDATE ai_credit_wallet SET purchased_balance = 2147483000 WHERE tenant_id = ?",
        [tenantId]
      )
      const wallet = await walletOf(c(), tenantId)
      const entries = await entriesOf(c(), tenantId)
      await expect(buy(tenantId, 1000, istanbul("2026-12-10"))).rejects.toThrow(/out of range/i)
      await expect(buy(tenantId, 2 ** 31, istanbul("2026-12-10"))).rejects.toThrow(
        "cp.ai_credit_amount_invalid"
      )
      expect(await walletOf(c(), tenantId)).toEqual(wallet)
      expect(await entriesOf(c(), tenantId)).toEqual(entries)
    })

    it("(10) the watch passes over releases that fail, counts them and releases the one behind them", async () => {
      const started = istanbul("2026-11-10", "11:00")
      const run = istanbul("2026-11-10", "12:00")
      // Three operations whose release would overflow their shop's balance
      const failing = shopId()
      await buy(failing, 200, istanbul("2026-11-10", "10:59"))
      for (let each = 0; each < 3; each += 1) {
        await call(failing, started)
      }
      await pgOf(c()).raw(
        "UPDATE ai_credit_wallet SET purchased_balance = 2147483637 WHERE tenant_id = ?",
        [failing]
      )
      // One behind them, joined by a second call: only the watch may close it now
      const kept = shopId()
      await setMonthlyGrant(c(), kept, 400)
      const operationId = opId()
      const later = istanbul("2026-11-10", "11:10")
      await call(kept, later, operationId)
      expect((await call(kept, later, operationId)).kind).toBe("repeat")
      expect((await release(c(), { tenantId: kept, operationId, now: later })).released).toBe(false)

      const result = await reconcileAiCredits(c(), run, { compare: false, batch: 2 })
      expect(result).toEqual({
        compared: false,
        mismatches: [],
        scanned: 4,
        released: 1,
        failed: 3,
      })
      expect(await operationOf(c(), kept, operationId)).toMatchObject({ status: "released" })
      expect((await walletOf(c(), kept))?.plan_balance).toBe(400)
      await expectLedgerMatchesWallet(c(), kept)
      const { rows } = await pgOf(c()).raw(
        "SELECT count(*)::int AS open FROM ai_credit_operation WHERE tenant_id = ? AND status = 'open'",
        [failing]
      )
      expect(rows[0]).toEqual({ open: 3 })
    })
  },
})
