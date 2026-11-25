import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { requestOrder } from "../../src/lib/ai-credits/grant"
import { adjustKey, entriesOf, expectLedgerMatchesWallet, walletOf } from "../helpers/ai-credits"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const CLOSED = { status: 409, data: { message: "cp.ai_credit_order_closed" } }

const PACK = {
  id: "pack_test",
  name: "Başlangıç",
  credits: 500,
  amount: 9_900,
  currency: "TRY" as const,
}

/**
 * adr/0085 §5, "Güvenlik", K11: what the owner does to a shop's credits
 * over HTTP. The wallet and its ledger read page by page; a correction
 * needs a note and its one key (sent twice, booked once); the shop's own
 * day's cap; a top-up request marked paid adds its credits once, a
 * cancelled one cannot be paid. Every change behind a step-up, in the audit.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
    })

    const post = async (path: string, body: unknown) =>
      call.post(path, body, owner, await proved(http, owner))

    it("shows a shop's wallet and ledger, corrects it once per key, and needs a note", async () => {
      const shop = await makeTenant(http, owner)
      const W = `/admin/cp/tenants/${shop.id}/ai-credits`
      expect((await call.get("/admin/cp/tenants/ten_nobody/ai-credits", owner)).status).toBe(404)
      const empty = await call.get(W, owner)
      expect(empty.status).toBe(200)
      expect(empty.data).toMatchObject({
        balance: {
          plan: { balance: 0 },
          purchased: { balance: 0, expiresAt: null },
          daily: { cap: 300 },
        },
        own_daily_cap: null,
        entries: [],
        count: 0,
      })

      const key = adjustKey()
      const body = { amount: 250, bucket: "purchased", note: "Havale 2611 karşılığı", key }
      expect((await post(`${W}/adjust`, { ...body, note: "" })).status).toBe(400)
      expect((await post(`${W}/adjust`, { amount: 250, bucket: "purchased", key })).status).toBe(
        400
      )
      expect((await post(`${W}/adjust`, { ...body, amount: 0 })).status).toBe(400)
      expect((await post(`${W}/adjust`, { ...body, amount: 1.5 })).status).toBe(400)
      expect((await post(`${W}/adjust`, { ...body, key: "not-a-uuid" })).status).toBe(400)
      expect(
        (await call.post(`${W}/adjust`, body, operator, await proved(http, operator))).status
      ).toBe(403)
      expect((await call.post(`${W}/adjust`, body, owner)).status).toBe(428)
      const first = await post(`${W}/adjust`, body)
      const again = await post(`${W}/adjust`, body)
      expect(first.data).toMatchObject({ applied: true, balance: 250 })
      expect(again.data).toMatchObject({ applied: false, balance: 250 })
      const short = await post(`${W}/adjust`, { ...body, amount: -300, key: adjustKey() })
      expect([short.status, (short.data as { message: string }).message]).toEqual([
        400,
        "cp.ai_credit_balance_short",
      ])
      expect(
        (await entriesOf(getContainer(), shop.id)).filter((each) => each.kind === "adjust")
      ).toEqual([
        expect.objectContaining({
          amount: 250,
          bucket: "purchased",
          note: "Havale 2611 karşılığı",
        }),
      ])
      await expectLedgerMatchesWallet(getContainer(), shop.id)

      const read = await call.get(`${W}?limit=1&offset=0`, owner)
      expect(read.data).toMatchObject({
        count: 1,
        limit: 1,
        entries: [{ kind: "adjust", amount: 250 }],
      })
      expect((await call.get(`${W}?limit=51`, owner)).status).toBe(400)

      // The correction's own row (amount and bucket) and the route's (no note's text)
      const own = await auditRows(getContainer(), {
        action: "ai_credit.adjust",
        resource_id: shop.id,
      })
      expect(own.map((row) => row.changes)).toEqual([expect.objectContaining({ amount: 250 })])
      const routed = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/ai-credits/adjust",
        resource_id: shop.id,
      })
      expect(routed.map((row) => row.outcome).sort()).toEqual([
        200, 200, 400, 400, 400, 400, 400, 400, 403, 428,
      ])
      expect(JSON.stringify(routed)).not.toContain("Havale")
    })

    it("sets a shop's own day's cap and gives it back to the platform's", async () => {
      const shop = await makeTenant(http, owner)
      const W = `/admin/cp/tenants/${shop.id}/ai-credits`
      expect((await post(`${W}/daily-cap`, { daily_cap: -1 })).status).toBe(400)
      expect((await post(`${W}/daily-cap`, { daily_cap: 50 })).data).toEqual({ own_daily_cap: 50 })
      expect((await call.get(W, owner)).data).toMatchObject({
        balance: { daily: { cap: 50 } },
        own_daily_cap: 50,
      })
      expect((await post(`${W}/daily-cap`, { daily_cap: null })).data).toEqual({
        own_daily_cap: null,
      })
      expect((await walletOf(getContainer(), shop.id))?.daily_cap).toBeNull()
      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/ai-credits/daily-cap",
        resource_id: shop.id,
        outcome: 200,
      })
      expect(audit.map((row) => row.changes)).toEqual([
        expect.objectContaining({ daily_cap: { from: null, to: 50 } }),
        expect.objectContaining({ daily_cap: { from: 50, to: null } }),
      ])
    })

    it("marks a request paid once, cancels another, and lists them by status", async () => {
      const shop = await makeTenant(http, owner)
      const now = new Date()
      const order = await requestOrder(getContainer(), {
        tenantId: shop.id,
        pack: PACK,
        requestedBy: "user_01",
        now,
      })
      const pending = await call.get("/admin/cp/ai/orders?status=pending", owner)
      const listed = (pending.data as { orders: { id: string }[] }).orders
      expect(listed.find((each) => each.id === order.id)).toMatchObject({
        tenant_id: shop.id,
        status: "pending",
        pack: PACK,
      })
      expect((await call.get("/admin/cp/ai/orders?status=lost", owner)).status).toBe(400)
      const O = `/admin/cp/ai/orders/${order.id}`
      expect((await post(`${O}/paid`, { method: "cash_in_hand" })).status).toBe(400)
      const [paid, twice] = [
        await post(`${O}/paid`, { method: "bank_transfer", reference: "EFT 2611-0042" }),
        await post(`${O}/paid`, { method: "bank_transfer", reference: "EFT 2611-0042" }),
      ]
      expect(paid.data).toMatchObject({
        applied: true,
        order: { status: "paid", reference: "EFT 2611-0042" },
      })
      expect(twice.data).toMatchObject({ applied: false, order: { status: "paid" } })
      expect(
        (await entriesOf(getContainer(), shop.id)).filter((each) => each.kind === "grant_purchase")
      ).toEqual([expect.objectContaining({ amount: 500, grant_ref: `order:${order.id}` })])
      expect((await walletOf(getContainer(), shop.id))?.purchased_balance).toBe(500)
      expect(await post(`${O}/cancel`, {})).toMatchObject(CLOSED)

      const next = await requestOrder(getContainer(), {
        tenantId: shop.id,
        pack: PACK,
        requestedBy: null,
        now,
      })
      const N = `/admin/cp/ai/orders/${next.id}`
      expect((await post(`${N}/cancel`, {})).data).toMatchObject({ order: { status: "cancelled" } })
      expect(await post(`${N}/cancel`, {})).toMatchObject(CLOSED)
      expect(await post(`${N}/paid`, { method: "bank_transfer" })).toMatchObject(CLOSED)
      expect(
        (
          await post(`/admin/cp/ai/orders/aiord_${randomUUID().slice(0, 8)}/paid`, {
            method: "bank_transfer",
          })
        ).status
      ).toBe(404)
      expect((await walletOf(getContainer(), shop.id))?.purchased_balance).toBe(500)

      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/ai/orders/:id/paid",
        resource_id: order.id,
        outcome: 200,
      })
      expect(audit.map((row) => (row.changes as { order?: unknown } | null)?.order)).toEqual([
        expect.objectContaining({ tenant_id: shop.id, applied: true, credits: 500 }),
        expect.objectContaining({ applied: false }),
      ])
      const cancelled = await auditRows(getContainer(), {
        action: "POST /admin/cp/ai/orders/:id/cancel",
        resource_id: next.id,
        outcome: 200,
      })
      expect(cancelled[0]?.changes).toMatchObject({
        order: { tenant_id: shop.id, to: "cancelled" },
      })
    })
  },
})
