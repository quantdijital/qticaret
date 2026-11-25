import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { grantPurchase, markOrderPaid, requestOrder } from "../../src/lib/ai-credits/grant"
import { spend } from "../../src/lib/ai-credits/spend"
import { Migration20261125011726 } from "../../src/modules/ai-credits/migrations/Migration20261125011726"
import {
  entriesOf,
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

/** The migration's statements, read without a database (MikroORM collects them). */
async function migrationSql(direction: "up" | "down"): Promise<string[]> {
  const migration = new Migration20261125011726({} as never, {} as never)
  await migration[direction]()
  return [...migration.getQueries()] as string[]
}

/**
 * One change, one transaction (PR #368 review O3): a statement that fails
 * after others of the same change took the whole change back with it, so
 * the module's raw statements run on the transaction's connection. And
 * the database's own guards (D4, D5): a row's sign follows its kind,
 * bought credits have a last day, the ledger is neither emptied nor
 * dropped by a rollback while it has rows.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const OCTOBER = istanbul("2026-10-20", "12:00")
    const NOVEMBER = istanbul("2026-11-10", "12:00")

    it("O3: a month's grant that cannot be written takes the month's roll and the spend back with it", async () => {
      const tenantId = shopId()
      await setMonthlyGrant(c(), tenantId, 10)
      await spend(c(), { tenantId, operationId: opId(), task: "seo_title", now: OCTOBER })
      const before = await walletOf(c(), tenantId)
      expect(before).toMatchObject({ plan_period: "2026-10", plan_balance: 9 })
      // A row already holding November's grant reference: the roll's own row will collide
      await pgOf(c()).raw(
        `INSERT INTO ai_credit_entry (id, tenant_id, kind, amount, bucket, grant_ref, actor)
         VALUES (?, ?, 'grant_plan_monthly', 5, 'plan', ?, 'system')`,
        [`aient_o3_${tenantId}`, tenantId, `plan:${tenantId}:2026-11`]
      )
      const entriesBefore = await entriesOf(c(), tenantId)

      const operationId = opId()
      await expect(
        spend(c(), { tenantId, operationId, task: "seo_title", now: NOVEMBER })
      ).rejects.toThrow(/duplicate key|unique|already exists/i)
      // The roll's update ran before the failing insert: it is gone with it
      expect(await walletOf(c(), tenantId)).toEqual(before)
      expect(await entriesOf(c(), tenantId)).toEqual(entriesBefore)
      expect(await operationOf(c(), tenantId, operationId)).toBeUndefined()
    })

    it("O3: a paid request whose credits cannot be added stays pending, nothing written", async () => {
      const tenantId = shopId()
      await grantPurchase(c(), {
        tenantId,
        credits: 1,
        grantRef: "eft-1",
        actor: "usr_test",
        now: NOVEMBER,
      })
      const order = await requestOrder(c(), {
        tenantId,
        pack: PACK,
        requestedBy: "usr_owner",
        now: NOVEMBER,
      })
      // The pack no longer fits the integer the balance is kept in
      await pgOf(c()).raw(
        "UPDATE ai_credit_wallet SET purchased_balance = 2147483600 WHERE tenant_id = ?",
        [tenantId]
      )
      const wallet = await walletOf(c(), tenantId)
      const entriesBefore = await entriesOf(c(), tenantId)
      const pay = () =>
        markOrderPaid(c(), {
          orderId: order.id,
          actor: "usr_finance",
          method: "bank_transfer",
          reference: "EFT-9",
          now: NOVEMBER,
        })
      await expect(pay()).rejects.toThrow(/out of range/i)
      const { rows } = await pgOf(c()).raw(
        "SELECT status, method, reference, decided_by FROM ai_credit_order WHERE id = ?",
        [order.id]
      )
      expect(rows[0]).toEqual({
        status: "pending",
        method: null,
        reference: null,
        decided_by: null,
      })
      expect(await walletOf(c(), tenantId)).toEqual(wallet)
      expect(await entriesOf(c(), tenantId)).toEqual(entriesBefore)

      // D1: the request's reference already taken by another shop's row is a conflict, not "paid"
      await pgOf(c()).raw("UPDATE ai_credit_wallet SET purchased_balance = 1 WHERE tenant_id = ?", [
        tenantId,
      ])
      await pgOf(c()).raw(
        `INSERT INTO ai_credit_entry (id, tenant_id, kind, amount, bucket, grant_ref, actor)
         VALUES (?, ?, 'grant_purchase', 500, 'purchased', ?, 'system')`,
        [`aient_d1_${tenantId}`, shopId(), `order:${order.id}`]
      )
      await expect(pay()).rejects.toThrow("cp.ai_credit_grant_ref_conflict")
      const { rows: after } = await pgOf(c()).raw(
        "SELECT status FROM ai_credit_order WHERE id = ?",
        [order.id]
      )
      expect(after[0]).toEqual({ status: "pending" })
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(1)
    })

    it("D5: refuses a row whose sign does not fit its kind, and bought credits without a last day", async () => {
      const tenantId = shopId()
      const pg = pgOf(c())
      const row = (id: string, kind: string, amount: number) =>
        pg.raw(
          `INSERT INTO ai_credit_entry (id, tenant_id, kind, amount, bucket, actor)
           VALUES (?, ?, ?, ?, 'plan', 'system')`,
          [`aient_${id}_${tenantId}`, tenantId, kind, amount]
        )
      for (const [kind, amount] of [
        ["spend", 1],
        ["expire", 1],
        ["grant_purchase", -1],
        ["grant_plan_monthly", -1],
        ["release", -1],
      ] as const) {
        await expect(row(`${kind}_bad`, kind, amount)).rejects.toThrow(
          /ai_credit_entry_kind_sign_check/
        )
      }
      for (const [kind, amount] of [
        ["spend", -1],
        ["expire", -1],
        ["grant_purchase", 1],
        ["grant_plan_monthly", 1],
        ["release", 1],
        ["adjust", 1],
        ["adjust", -1],
      ] as const) {
        await row(`${kind}_${amount > 0 ? "plus" : "minus"}`, kind, amount)
      }
      await grantPurchase(c(), {
        tenantId,
        credits: 5,
        grantRef: "eft-5",
        actor: "usr_test",
        now: NOVEMBER,
      })
      await expect(
        pg.raw("UPDATE ai_credit_wallet SET purchased_expires_at = NULL WHERE tenant_id = ?", [
          tenantId,
        ])
      ).rejects.toThrow(/ai_credit_wallet_purchased_expiry_check/)
      await expect(pg.raw("TRUNCATE ai_credit_entry")).rejects.toThrow(/append-only/)
    })

    it("D4: down drops the tables only while the ledger is empty; up brings them back", async () => {
      const pg = pgOf(c())
      const [guard = "", ...drops] = await migrationSql("down")
      expect(guard).toMatch(/raise exception/)
      // An empty ledger: down runs whole, up again makes the tables anew
      for (const statement of [guard, ...drops, ...(await migrationSql("up"))]) {
        await pg.raw(statement)
      }
      const tenantId = shopId()
      await grantPurchase(c(), {
        tenantId,
        credits: 3,
        grantRef: "eft-3",
        actor: "usr_test",
        now: NOVEMBER,
      })
      // With a row, down stops at its first statement and drops nothing
      await expect(pg.raw(guard)).rejects.toThrow(/ledger is not dropped/)
      expect(await entriesOf(c(), tenantId)).toHaveLength(1)
    })
  },
})
