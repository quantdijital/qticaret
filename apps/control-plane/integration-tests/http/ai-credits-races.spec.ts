import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AI_TASK_CREDITS } from "@qticaret/types/control-plane"
import {
  adjust,
  cancelOrder,
  cancelOrderAsStaff,
  grantPurchase,
  markOrderPaid,
  requestOrder,
} from "../../src/lib/ai-credits/grant"
import { release, settle, spend } from "../../src/lib/ai-credits/spend"
import type { SpendResult } from "../../src/lib/ai-credits/spend"
import {
  adjustKey,
  countBy,
  entriesOf,
  expectLedgerMatchesWallet,
  istanbul,
  opId,
  operationOf,
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

// A picture set in a scene: two calls an operation (the case the review named)
const TASK = "image_scene"
const COST = AI_TASK_CREDITS[TASK]
const GRANT = 400
const ROUNDS = 6

/**
 * The money under calls at the same moment (`Promise.all`) beyond the
 * acceptance races: an operation's second call against its release
 * (PR #368 review O1), release against settle, a request paid and
 * cancelled at once, two corrections at once, and another shop's
 * operation id. Each race runs several rounds, each on a shop of its own;
 * whichever order the database picks, no credit is lost or made.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const NOW = istanbul("2026-11-10", "12:00")
    const call = (tenantId: string, operationId: string) =>
      spend(c(), { tenantId, operationId, task: TASK, now: NOW })
    const giveBack = (tenantId: string, operationId: string) =>
      release(c(), { tenantId, operationId, now: NOW })
    const keep = (tenantId: string, operationId: string) =>
      settle(c(), { tenantId, operationId, measures: { model: "m" }, now: NOW })
    const shopWithGrant = async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, GRANT)
      return tenantId
    }
    const planLeft = async (tenantId: string) => (await walletOf(c(), tenantId))?.plan_balance
    const refusals = (results: PromiseSettledResult<unknown>[]) =>
      results.flatMap((each) => (each.status === "rejected" ? [String(each.reason)] : []))
    const statusOf = async (tenantId: string, operationId: string) =>
      (await operationOf(c(), tenantId, operationId))?.["status"]

    it("O1: a second call and the first call's release at once: never a call on given-back credits", async () => {
      const seen = new Set<string>()
      for (let round = 0; round < ROUNDS; round += 1) {
        const tenantId = await shopWithGrant()
        const operationId = opId()
        expect((await call(tenantId, operationId)).kind).toBe("charged")
        const [second, released] = await Promise.all([
          call(tenantId, operationId),
          giveBack(tenantId, operationId),
        ])
        await keep(tenantId, operationId)
        seen.add(second.kind)
        if (second.kind === "repeat") {
          // The second call went on: the charge holds for it
          expect(released.released).toBe(false)
          expect(await statusOf(tenantId, operationId)).toBe("charged")
          expect(await planLeft(tenantId)).toBe(GRANT - COST)
        } else {
          // The release came first: the operation is closed to the second call
          expect(second.kind).toBe("expired_operation")
          expect(released.released).toBe(true)
          expect(await statusOf(tenantId, operationId)).toBe("released")
          expect(await planLeft(tenantId)).toBe(GRANT)
        }
        await expectLedgerMatchesWallet(c(), tenantId)
      }
      expect([...seen].every((kind) => ["repeat", "expired_operation"].includes(kind))).toBe(true)
    })

    it("O1: two first calls at once, then release and settle at once: charged once, never given back", async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        const tenantId = await shopWithGrant()
        const operationId = opId()
        const calls = await Promise.all([call(tenantId, operationId), call(tenantId, operationId)])
        expect(countBy(calls, (each) => each.kind)).toEqual({ charged: 1, repeat: 1 })
        const [released, settled] = await Promise.all([
          giveBack(tenantId, operationId),
          keep(tenantId, operationId),
        ])
        expect(released.released).toBe(false)
        expect(settled.settled).toBe(true)
        expect(await statusOf(tenantId, operationId)).toBe("charged")
        expect(await planLeft(tenantId)).toBe(GRANT - COST)
        await expectLedgerMatchesWallet(c(), tenantId)
      }
    })

    it("O1: two calls, a release and a settle all at once: a call that went on is always paid for", async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        const tenantId = await shopWithGrant()
        const operationId = opId()
        const [first, second, released] = await Promise.all([
          call(tenantId, operationId),
          call(tenantId, operationId),
          giveBack(tenantId, operationId),
          keep(tenantId, operationId),
        ])
        const results: SpendResult[] = [first, second]
        const status = await statusOf(tenantId, operationId)
        expect(results.filter((each) => each.kind === "charged")).toHaveLength(1)
        if (results.some((each) => each.kind === "repeat")) {
          expect(status).not.toBe("released")
          expect(released.released).toBe(false)
        }
        expect(await planLeft(tenantId)).toBe(status === "released" ? GRANT : GRANT - COST)
        await expectLedgerMatchesWallet(c(), tenantId)
      }
    })

    it("a release and a settle of one open operation at once: exactly one of them", async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        const tenantId = await shopWithGrant()
        const operationId = opId()
        await call(tenantId, operationId)
        const [released, settled] = await Promise.all([
          giveBack(tenantId, operationId),
          keep(tenantId, operationId),
        ])
        expect(Number(released.released) + Number(settled.settled)).toBe(1)
        expect(await statusOf(tenantId, operationId)).toBe(
          released.released ? "released" : "charged"
        )
        expect(await planLeft(tenantId)).toBe(released.released ? GRANT : GRANT - COST)
        await expectLedgerMatchesWallet(c(), tenantId)
      }
    })

    it("another shop's operation id neither releases nor settles it; spent, it is that shop's own", async () => {
      const owner = await shopWithGrant()
      const other = await shopWithGrant()
      const operationId = opId()
      await call(owner, operationId)
      expect((await giveBack(other, operationId)).released).toBe(false)
      expect((await keep(other, operationId)).settled).toBe(false)
      expect(await statusOf(owner, operationId)).toBe("open")
      expect(await planLeft(owner)).toBe(GRANT - COST)
      // The same id from another shop is that shop's operation, on its wallet
      expect((await call(other, operationId)).kind).toBe("charged")
      expect(await planLeft(other)).toBe(GRANT - COST)
      expect(await planLeft(owner)).toBe(GRANT - COST)
      await expectLedgerMatchesWallet(c(), owner)
      await expectLedgerMatchesWallet(c(), other)
    })

    it("a request paid and cancelled at once ends one way, and two requests at once make one", async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        const tenantId = shopId()
        const asked = await Promise.allSettled([
          requestOrder(c(), { tenantId, pack: PACK, requestedBy: "usr_owner", now: NOW }),
          requestOrder(c(), { tenantId, pack: PACK, requestedBy: "usr_owner", now: NOW }),
        ])
        const made = asked.flatMap((each) => (each.status === "fulfilled" ? [each.value] : []))
        expect(made).toHaveLength(1)
        expect(refusals(asked)).toEqual([expect.stringContaining("cp.ai_credit_order_pending")])
        const orderId = made[0]?.id ?? ""
        const cancel =
          round % 2 === 0
            ? cancelOrder(c(), { tenantId, orderId, actor: "usr_owner", now: NOW })
            : cancelOrderAsStaff(c(), { orderId, actor: "usr_finance", now: NOW })
        const decided = await Promise.allSettled([
          markOrderPaid(c(), { orderId, actor: "usr_finance", method: "bank_transfer", now: NOW }),
          cancel,
        ])
        expect(decided.filter((each) => each.status === "fulfilled")).toHaveLength(1)
        const purchases = (await entriesOf(c(), tenantId)).filter(
          (each) => each.kind === "grant_purchase"
        )
        if (decided[0].status === "fulfilled") {
          expect(purchases).toEqual([expect.objectContaining({ amount: 500 })])
          expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(500)
        } else {
          expect(purchases).toEqual([])
          expect((await walletOf(c(), tenantId))?.purchased_balance ?? 0).toBe(0)
        }
        await expectLedgerMatchesWallet(c(), tenantId)
      }
    })

    it("two corrections taking 6 of 10 at once: one holds, the other is short; one key twice corrects once", async () => {
      const tenantId = shopId()
      await grantPurchase(c(), {
        tenantId,
        credits: 10,
        grantRef: "eft-10",
        actor: "usr_test",
        now: NOW,
      })
      const take = (key: string) =>
        adjust(c(), {
          tenantId,
          key,
          amount: -6,
          bucket: "purchased",
          note: "fazla yükleme",
          actor: "usr_staff",
          now: NOW,
        })
      const both = await Promise.allSettled([take(adjustKey()), take(adjustKey())])
      expect(both.filter((each) => each.status === "fulfilled")).toHaveLength(1)
      expect(refusals(both)).toEqual([expect.stringContaining("cp.ai_credit_balance_short")])
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(4)

      // The same key at once (a retried request): one row, one change
      const key = adjustKey()
      const give = () =>
        adjust(c(), {
          tenantId,
          key,
          amount: 3,
          bucket: "purchased",
          note: "telafi",
          actor: "usr_staff",
          now: NOW,
        })
      const twice = await Promise.all([give(), give()])
      expect(twice.filter((each) => each.applied)).toHaveLength(1)
      expect(new Set(twice.map((each) => each.entryId)).size).toBe(1)
      expect((await give()).applied).toBe(false)
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(7)
      const corrections = (await entriesOf(c(), tenantId)).filter((each) => each.kind === "adjust")
      expect(corrections.map((each) => each.amount).sort()).toEqual([-6, 3])
      await expectLedgerMatchesWallet(c(), tenantId)
    })
  },
})
