import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import {
  adjust,
  cancelOrder,
  grantPurchase,
  markOrderPaid,
  requestOrder,
} from "../../src/lib/ai-credits/grant"
import { reconcileAiCredits } from "../../src/lib/ai-credits/reconcile"
import { release, settle, spend } from "../../src/lib/ai-credits/spend"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { aiCreditsIn } from "../../src/workflows/modules"
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

const PACK = {
  id: "kredi-500",
  name: "500 kredi",
  credits: 500,
  amount: 75_000,
  currency: "TRY" as const,
}

/**
 * adr/0085 §1 beyond the acceptance races: what settles and expires, the
 * staff's corrections and the top-up requests, the watch that compares
 * ledger and wallet, and the database's own refusals.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const NOW = istanbul("2026-11-10", "12:00")
    const buy = (tenantId: string, credits: number, now: Date, ref = `test:${now.toISOString()}`) =>
      grantPurchase(c(), { tenantId, credits, grantRef: ref, actor: "usr_test", now })

    it("names no price: a task off the table is not offered, whatever the wallet holds", async () => {
      const tenantId = shopId()
      await buy(tenantId, 100, NOW)
      for (const task of ["search_intent", "test_text", "made_up"]) {
        expect(await spend(c(), { tenantId, operationId: opId(), task, now: NOW })).toEqual({
          kind: "not_offered",
        })
      }
      expect(await walletOf(c(), tenantId)).toMatchObject({ purchased_balance: 100 })
    })

    it("settles an open operation once with its measures; a release after it gives nothing back", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 5)
      const operationId = opId()
      await spend(c(), { tenantId, operationId, task: "image_alt_text", now: NOW })
      const measures = {
        service: "deepseek",
        model: "deepseek-chat",
        inputTokens: 1200,
        outputTokens: 80,
        images: 1,
        estimatedCostMicros: 2400,
      }
      expect(await settle(c(), { tenantId, operationId, measures, now: NOW })).toEqual({
        settled: true,
      })
      expect(await settle(c(), { tenantId, operationId, measures, now: NOW })).toEqual({
        settled: false,
      })
      expect(await operationOf(c(), tenantId, operationId)).toMatchObject({
        status: "charged",
        capability: "vision",
        service: "deepseek",
        input_tokens: 1200,
        output_tokens: 80,
        images: 1,
        estimated_cost_micros: 2400,
      })
      expect((await release(c(), { tenantId, operationId, now: NOW })).released).toBe(false)
      expect(await walletOf(c(), tenantId)).toMatchObject({ plan_balance: 3 })
    })

    it("gives back no grant across a month's turn: the old month's credits do not carry over", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 1)
      await buy(tenantId, 5, NOW)
      const operationId = opId()
      const lastMinute = istanbul("2026-11-30", "23:55")
      expect(
        await spend(c(), { tenantId, operationId, task: "product_faq", now: lastMinute })
      ).toMatchObject({ kind: "charged", plan: 1, purchased: 1 })
      const december = istanbul("2026-12-01", "00:05")
      expect(await release(c(), { tenantId, operationId, now: december })).toEqual({
        released: true,
        plan: 0,
        purchased: 1,
      })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 1,
        plan_period: "2026-12",
        purchased_balance: 5,
      })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("expires bought credits on their day, and every top-up moves that day for all of them", async () => {
      const tenantId = shopId()
      const first = istanbul("2026-01-15")
      await buy(tenantId, 100, first)
      expect((await walletOf(c(), tenantId))?.purchased_expires_at).toEqual(istanbul("2027-01-15"))
      const second = istanbul("2026-07-15")
      await spend(c(), { tenantId, operationId: opId(), task: "image_background", now: second })
      await buy(tenantId, 50, second)
      const after = await balanceOf(c(), tenantId, istanbul("2027-01-20"))
      expect(after.purchased).toEqual({ balance: 140, expiresAt: istanbul("2027-07-15") })

      const past = await balanceOf(c(), tenantId, istanbul("2027-07-15", "12:00"))
      expect(past.purchased.balance).toBe(0)
      const expiries = (await entriesOf(c(), tenantId)).filter(
        (each) => each.kind === "expire" && each.bucket === "purchased"
      )
      expect(expiries).toEqual([expect.objectContaining({ amount: -140 })])
      // A top-up after the day starts a new life; what expired stays expired
      await buy(tenantId, 10, istanbul("2027-08-01"))
      expect(await walletOf(c(), tenantId)).toMatchObject({ purchased_balance: 10 })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("takes a staff correction only with a note, never below 0, and audits it", async () => {
      const tenantId = shopId()
      await buy(tenantId, 10, NOW)
      const correction = { tenantId, bucket: "purchased" as const, actor: "usr_staff", now: NOW }
      await expect(adjust(c(), { ...correction, amount: 5, note: "  " })).rejects.toThrow(
        "cp.ai_credit_note_required"
      )
      await expect(adjust(c(), { ...correction, amount: -11, note: "fazla" })).rejects.toThrow(
        "cp.ai_credit_balance_short"
      )
      await expect(
        adjust(c(), { ...correction, bucket: "plan", amount: -1, note: "hak yok" })
      ).rejects.toThrow("cp.ai_credit_balance_short")
      expect(await walletOf(c(), tenantId)).toMatchObject({
        purchased_balance: 10,
        plan_balance: 0,
      })

      const done = await adjust(c(), { ...correction, amount: -4, note: "hatalı yükleme" })
      expect(done.balance).toBe(6)
      // The refused corrections wrote nothing
      expect((await entriesOf(c(), tenantId)).filter((each) => each.kind === "adjust")).toEqual([
        expect.objectContaining({
          amount: -4,
          bucket: "purchased",
          note: "hatalı yükleme",
          actor: "usr_staff",
        }),
      ])
      const [audited] = await c()
        .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
        .listCpAuditEntries({ action: "ai_credit.adjust", resource_id: tenantId })
      expect(audited).toMatchObject({
        actor_id: "usr_staff",
        changes: { bucket: "purchased", amount: -4, balance: 6, entry_id: done.entryId },
      })
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("keeps one pending request a shop; paid twice, even at once, it adds its pack once", async () => {
      const tenantId = shopId()
      const order = await requestOrder(c(), {
        tenantId,
        pack: PACK,
        requestedBy: "owner",
        now: NOW,
      })
      expect(order).toMatchObject({ status: "pending", credits: 500, amount: 75_000 })
      await expect(
        requestOrder(c(), { tenantId, pack: PACK, requestedBy: "owner", now: NOW })
      ).rejects.toThrow("cp.ai_credit_order_pending")

      const pay = () =>
        markOrderPaid(c(), {
          orderId: order.id,
          actor: "usr_finance",
          method: "bank_transfer",
          reference: "EFT-1",
          now: NOW,
        })
      const results = await Promise.all([pay(), pay()])
      expect(results.filter((each) => each.applied)).toHaveLength(1)
      expect((await pay()).applied).toBe(false)
      expect(await walletOf(c(), tenantId)).toMatchObject({ purchased_balance: 500 })
      expect(
        (await entriesOf(c(), tenantId)).filter((each) => each.kind === "grant_purchase")
      ).toEqual([expect.objectContaining({ amount: 500, grant_ref: `order:${order.id}` })])

      // Paid, the next request may come; a cancelled one cannot be paid
      const next = await requestOrder(c(), { tenantId, pack: PACK, requestedBy: null, now: NOW })
      expect(
        (await cancelOrder(c(), { orderId: next.id, actor: "usr_finance", now: NOW })).status
      ).toBe("cancelled")
      await expect(
        markOrderPaid(c(), { orderId: next.id, actor: "usr_finance", method: "other", now: NOW })
      ).rejects.toThrow("cp.ai_credit_order_closed")
      await expect(
        cancelOrder(c(), { orderId: order.id, actor: "usr_finance", now: NOW })
      ).rejects.toThrow("cp.ai_credit_order_closed")
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("reports a wallet that left its ledger without mending it, and releases operations left open", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 10)
      const operationId = opId()
      await spend(c(), { tenantId, operationId, task: "product_from_photo", now: NOW })
      await pgOf(c()).raw(
        "UPDATE ai_credit_wallet SET purchased_balance = purchased_balance + 5 WHERE tenant_id = ?",
        [tenantId]
      )

      // Fourteen minutes on, the operation may still be answered: it stays open
      const soon = await reconcileAiCredits(c(), new Date(NOW.getTime() + 14 * 60 * 1000))
      expect(soon.mismatches.filter((each) => each.tenant_id === tenantId)).toEqual([
        {
          tenant_id: tenantId,
          wallet: { plan: 7, purchased: 5 },
          ledger: { plan: 7, purchased: 0 },
        },
      ])
      expect(await operationOf(c(), tenantId, operationId)).toMatchObject({ status: "open" })
      expect(await walletOf(c(), tenantId)).toMatchObject({ purchased_balance: 5 })

      const later = await reconcileAiCredits(c(), new Date(NOW.getTime() + 16 * 60 * 1000))
      expect(later.released).toBeGreaterThanOrEqual(1)
      expect(later.failed).toBe(0)
      expect(await operationOf(c(), tenantId, operationId)).toMatchObject({ status: "released" })
      expect(await walletOf(c(), tenantId)).toMatchObject({
        plan_balance: 10,
        purchased_balance: 5,
      })
      // Still reported: the watch never writes the difference away
      const again = await reconcileAiCredits(c(), new Date(NOW.getTime() + 17 * 60 * 1000))
      expect(again.mismatches.some((each) => each.tenant_id === tenantId)).toBe(true)
    })

    it("refuses at the database a negative balance and a ledger row changed or removed", async () => {
      const tenantId = shopId()
      await buy(tenantId, 3, NOW)
      const pg = pgOf(c())
      await expect(
        pg.raw("UPDATE ai_credit_wallet SET purchased_balance = -1 WHERE tenant_id = ?", [tenantId])
      ).rejects.toThrow(/ai_credit_wallet_purchased_balance_check/)
      await expect(
        pg.raw("UPDATE ai_credit_wallet SET plan_balance = plan_balance - 1 WHERE tenant_id = ?", [
          tenantId,
        ])
      ).rejects.toThrow(/ai_credit_wallet_plan_balance_check/)
      await expect(
        pg.raw("UPDATE ai_credit_entry SET amount = 300 WHERE tenant_id = ?", [tenantId])
      ).rejects.toThrow(/append-only/)
      await expect(
        pg.raw("DELETE FROM ai_credit_entry WHERE tenant_id = ?", [tenantId])
      ).rejects.toThrow(/append-only/)
      await expect(
        pg.raw(
          `INSERT INTO ai_credit_entry (id, tenant_id, kind, amount, bucket, actor)
           VALUES ('aient_zero', ?, 'adjust', 0, 'plan', 'system')`,
          [tenantId]
        )
      ).rejects.toThrow(/ai_credit_entry_amount_check/)
      // The module's generated writers are closed too
      const credits = aiCreditsIn(c()) as unknown as Record<string, () => Promise<unknown>>
      for (const writer of [
        "updateAiCreditWallets",
        "createAiCreditEntries",
        "deleteAiCreditEntries",
      ]) {
        expect(() => credits[writer]?.()).toThrow("cp.ai_credit_write_refused")
      }
      await expectLedgerMatchesWallet(c(), tenantId)
    })
  },
})
