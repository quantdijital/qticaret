import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import { grantPurchase } from "../../src/lib/ai-credits/grant"
import { release, spend } from "../../src/lib/ai-credits/spend"
import type { SpendResult } from "../../src/lib/ai-credits/spend"
import {
  countBy,
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

/**
 * adr/0085 "Kabul testleri" 1–6, on the real database: the money's
 * guarantees under calls at the same moment (`Promise.all`), with the
 * clock given by the test. Ledger and wallet agree after each.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const NOW = istanbul("2026-11-10", "12:00")
    const spendAt = (tenantId: string, task: string, now = NOW, operationId = opId()) =>
      spend(c(), { tenantId, operationId, task, now })
    const kinds = (results: SpendResult[]) => countBy(results, (each) => each.kind)

    it("(1) one credit left, two calls at once: one is charged, the other finds it spent", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 1)
      // The wallet does not exist yet: both make it and roll its month at the same moment
      const results = await Promise.all([
        spendAt(tenantId, "seo_title"),
        spendAt(tenantId, "seo_title"),
      ])
      expect(kinds(results)).toEqual({ charged: 1, exhausted: 1 })
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 0, spent_today: 1 })
      const entries = await entriesOf(c(), tenantId)
      expect(entries.filter((each) => each.kind === "grant_plan_monthly")).toHaveLength(1)
      expect(entries.filter((each) => each.kind === "spend")).toHaveLength(1)
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(1) seven credits over both buckets, twenty calls at once: exactly seven charged", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 3)
      await grantPurchase(c(), {
        tenantId,
        credits: 4,
        grantRef: `test:${tenantId}`,
        actor: "usr_test",
        now: NOW,
      })
      const results = await Promise.all(
        Array.from({ length: 20 }, () => spendAt(tenantId, "seo_description"))
      )
      expect(kinds(results)).toEqual({ charged: 7, exhausted: 13 })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 0,
        purchased_balance: 0,
        spent_today: 7,
      })
      // The grant went first: three calls from the plan, four from the bought credits
      const spent = (await entriesOf(c(), tenantId)).filter((each) => each.kind === "spend")
      expect(countBy(spent, (each) => each.bucket)).toEqual({ plan: 3, purchased: 4 })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(2) a release gives the credits back to the buckets they came from, once", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 1)
      await grantPurchase(c(), {
        tenantId,
        credits: 5,
        grantRef: `test:${tenantId}`,
        actor: "usr_test",
        now: NOW,
      })
      const operationId = opId()
      // Two credits: one from the month's grant, one bought
      const charged = await spendAt(tenantId, "product_description", NOW, operationId)
      expect(charged).toMatchObject({ kind: "charged", credits: 2, plan: 1, purchased: 1 })
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 0, purchased_balance: 4 })

      const first = await release(c(), { tenantId, operationId, now: NOW })
      expect(first).toEqual({ released: true, plan: 1, purchased: 1 })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 1,
        purchased_balance: 5,
        spent_today: 0,
      })
      const releases = (await entriesOf(c(), tenantId)).filter((each) => each.kind === "release")
      expect(releases).toEqual([
        expect.objectContaining({ amount: 1, bucket: "plan", operation_id: operationId }),
        expect.objectContaining({ amount: 1, bucket: "purchased", operation_id: operationId }),
      ])
      expect(await operationOf(c(), tenantId, operationId)).toMatchObject({ status: "released" })

      // Again, and twice at once: nothing more comes back
      const again = await Promise.all([
        release(c(), { tenantId, operationId, now: NOW }),
        release(c(), { tenantId, operationId, now: NOW }),
      ])
      expect(again.every((each) => !each.released)).toBe(true)
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 1, purchased_balance: 5 })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(3) the same operation's later calls charge nothing, up to the task's call cap", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 10)
      const operationId = opId()
      // A text task: three calls per operation (AI_CALLS_PER_OPERATION.text)
      const calls = []
      for (let index = 0; index < 4; index += 1) {
        calls.push(await spendAt(tenantId, "seo_title", NOW, operationId))
      }
      expect(calls.map((each) => each.kind)).toEqual(["charged", "repeat", "repeat", "call_cap"])
      expect(calls[2]).toMatchObject({ kind: "repeat", calls: 3, balance: { plan: 9 } })
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 9, spent_today: 1 })
      expect(await operationOf(c(), tenantId, operationId)).toMatchObject({ calls: 3, credits: 1 })

      // Two later calls at once on a fresh operation: one charge, one repeat
      const other = opId()
      const pair = await Promise.all([
        spendAt(tenantId, "seo_title", NOW, other),
        spendAt(tenantId, "seo_title", NOW, other),
      ])
      expect(kinds(pair)).toEqual({ charged: 1, repeat: 1 })
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 8 })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(3) an operation's id names one task, lives ten minutes and ends with its release", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 10)
      const operationId = opId()
      expect(await spendAt(tenantId, "seo_title", NOW, operationId)).toMatchObject({
        kind: "charged",
      })
      // A dearer task under a cheap operation's id buys nothing
      expect(await spendAt(tenantId, "image_scene", NOW, operationId)).toEqual({
        kind: "task_mismatch",
      })
      // A capability the task may not call as
      expect(
        await spend(c(), {
          tenantId,
          operationId: opId(),
          task: "seo_title",
          capability: "image_edit",
          now: NOW,
        })
      ).toEqual({ kind: "task_mismatch" })
      const later = new Date(NOW.getTime() + 10 * 60 * 1000)
      expect(await spendAt(tenantId, "seo_title", later, operationId)).toEqual({
        kind: "expired_operation",
      })
      // Released, its id is spent: a free call cannot ride on credits given back
      const failed = opId()
      await spendAt(tenantId, "seo_title", NOW, failed)
      await release(c(), { tenantId, operationId: failed, now: NOW })
      expect(await spendAt(tenantId, "seo_title", NOW, failed)).toEqual({
        kind: "expired_operation",
      })
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 9 })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(4) a new month: the old grant's rest expires, the new one is written once; bought credits stay", async () => {
      const tenantId = shopId()
      const october = istanbul("2026-10-20")
      await setMonthlyGrant(c(), tenantId, 10)
      await grantPurchase(c(), {
        tenantId,
        credits: 5,
        grantRef: `test:${tenantId}`,
        actor: "usr_test",
        now: october,
      })
      await spendAt(tenantId, "post_draft", october)
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 6,
        plan_period: "2026-10",
      })

      // The package's grant changed meanwhile: the new month gives the new value
      await setMonthlyGrant(c(), tenantId, 20)
      const november = istanbul("2026-11-01", "00:00")
      const balance = await balanceOf(c(), tenantId, november)
      expect(balance.plan).toEqual({ balance: 20, period: "2026-11", renewsOn: "2026-12-01" })
      expect(balance.purchased.balance).toBe(5)
      const entries = await entriesOf(c(), tenantId)
      expect(entries.slice(-2)).toEqual([
        expect.objectContaining({
          kind: "expire",
          amount: -6,
          bucket: "plan",
          note: "plan:2026-10",
        }),
        expect.objectContaining({
          kind: "grant_plan_monthly",
          amount: 20,
          bucket: "plan",
          grant_ref: `plan:${tenantId}:2026-11`,
        }),
      ])

      // December's first touches, four at once: one roll, one grant
      const december = istanbul("2026-12-01", "09:00")
      await Promise.all([
        balanceOf(c(), tenantId, december),
        spendAt(tenantId, "seo_title", december),
        balanceOf(c(), tenantId, december),
        spendAt(tenantId, "seo_title", december),
      ])
      const decemberGrants = (await entriesOf(c(), tenantId)).filter(
        (each) => each.grant_ref === `plan:${tenantId}:2026-12`
      )
      expect(decemberGrants).toHaveLength(1)
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 18,
        plan_period: "2026-12",
        purchased_balance: 5,
      })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(5) the same grant_ref twice, also at once: one row, one increase", async () => {
      const tenantId = shopId()
      const grant = () =>
        grantPurchase(c(), {
          tenantId,
          credits: 50,
          grantRef: `eft:test_${tenantId}`,
          actor: "usr_test",
          now: NOW,
        })
      const results = await Promise.all([grant(), grant(), grant()])
      expect(results.filter((each) => each.applied)).toHaveLength(1)
      expect((await grant()).applied).toBe(false)
      expect(await walletOf(c(), tenantId)).toMatchObject({ purchased_balance: 50 })
      const purchases = (await entriesOf(c(), tenantId)).filter(
        (each) => each.kind === "grant_purchase"
      )
      expect(purchases).toEqual([
        expect.objectContaining({ amount: 50, grant_ref: `eft:test_${tenantId}` }),
      ])
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("(6) the day's cap refuses past 300 credits and opens on the next Istanbul day", async () => {
      const tenantId = shopId()
      await grantPurchase(c(), {
        tenantId,
        credits: 1000,
        grantRef: `test:${tenantId}`,
        actor: "usr_test",
        now: NOW,
      })
      const lateEvening = istanbul("2026-11-10", "23:50")
      // Seven scenes at 40: 280 of 300; eight at once, so the cap holds under a race too
      const results = await Promise.all(
        Array.from({ length: 8 }, () => spendAt(tenantId, "image_scene", lateEvening))
      )
      expect(kinds(results)).toEqual({ charged: 7, daily_cap: 1 })
      // 20 left today: a 10-credit task still goes, a 40-credit one does not
      expect(await spendAt(tenantId, "image_background", lateEvening)).toMatchObject({
        kind: "charged",
      })
      expect(await spendAt(tenantId, "image_scene", lateEvening)).toEqual({ kind: "daily_cap" })
      expect((await balanceOf(c(), tenantId, lateEvening)).daily).toEqual({
        cap: 300,
        spent: 290,
        remaining: 10,
      })
      // Midnight in Istanbul is 21:00 UTC: the next day's counter starts at nothing
      const midnight = istanbul("2026-11-11", "00:00")
      expect(await spendAt(tenantId, "image_scene", midnight)).toMatchObject({ kind: "charged" })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        spent_today: 40,
        spent_day: "2026-11-11",
        purchased_balance: 1000 - 290 - 40,
      })
      // A shop's own cap is its wallet's
      await pgOf(c()).raw("UPDATE ai_credit_wallet SET daily_cap = 45 WHERE tenant_id = ?", [
        tenantId,
      ])
      expect(await spendAt(tenantId, "image_background", midnight)).toEqual({ kind: "daily_cap" })
      expect(await spendAt(tenantId, "seo_title", midnight)).toMatchObject({ kind: "charged" })
      await expectLedgerMatchesWallet(c(), tenantId)
    })
  },
})
