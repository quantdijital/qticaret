import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { requestOrder } from "../../src/lib/ai-credits/grant"
import { adjustKey } from "../helpers/ai-credits"
import { aiShop } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const PACK = {
  id: "pack_test",
  name: "Başlangıç",
  credits: 500,
  amount: 9_900,
  currency: "TRY" as const,
}

interface Shop {
  name: string
  slug: string
  primary_hostname: unknown
}

/**
 * P3d: what the owner's AI credit screens need from the routes they
 * already call. Each request names its shop; a cancellation keeps the
 * owner's optional note in its audit row; the wallet says whether the
 * shop's plan has the flag on, its status and its month's whole grant,
 * and each ledger row the staff member's name beside their id.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
    })

    const postAs = async (member: Member, path: string, body: unknown) =>
      call.post(path, body, member, await proved(http, member))
    const post = (path: string, body: unknown) => postAs(owner, path, body)

    it("names each request's shop, and keeps a cancellation's note in its audit row", async () => {
      const made = await makeTenant(http, owner)
      const now = new Date()
      const order = await requestOrder(getContainer(), {
        tenantId: made.id,
        pack: PACK,
        requestedBy: null,
        now,
      })
      const shop: Shop = {
        name: "Atölye Bıçak",
        slug: made.slug,
        primary_hostname: expect.stringContaining(made.slug) as unknown,
      }
      const listed = await call.get("/admin/cp/ai/orders?status=pending", owner)
      const orders = (listed.data as { orders: { id: string; tenant: Shop | null }[] }).orders
      expect(orders.find((each) => each.id === order.id)).toMatchObject({
        tenant_id: made.id,
        tenant: shop,
      })

      const O = `/admin/cp/ai/orders/${order.id}/cancel`
      expect((await post(O, { note: "satır\u0000sonu" })).status).toBe(400)
      expect((await post(O, { note: "x".repeat(501) })).status).toBe(400)
      expect((await post(O, { note: "Mağaza vazgeçti", other: 1 })).status).toBe(400)
      const cancelled = await post(O, { note: "  Mağaza vazgeçti  " })
      expect(cancelled.data).toMatchObject({
        order: { status: "cancelled", tenant: shop },
      })
      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/ai/orders/:id/cancel",
        resource_id: order.id,
        outcome: 200,
      })
      expect(audit.map((row) => row.changes)).toEqual([
        expect.objectContaining({
          order: { tenant_id: made.id, to: "cancelled", credits: 500, note: "Mağaza vazgeçti" },
        }),
      ])

      // Without a note, as before: none in the audit row; a paid one names its shop too
      const next = await requestOrder(getContainer(), {
        tenantId: made.id,
        pack: PACK,
        requestedBy: null,
        now,
      })
      const N = `/admin/cp/ai/orders/${next.id}`
      const paid = await post(`${N}/paid`, { method: "bank_transfer" })
      expect(paid.data).toMatchObject({ applied: true, order: { tenant: shop } })
      const third = await requestOrder(getContainer(), {
        tenantId: made.id,
        pack: PACK,
        requestedBy: null,
        now,
      })
      expect((await post(`/admin/cp/ai/orders/${third.id}/cancel`, {})).status).toBe(200)
      const plain = await auditRows(getContainer(), {
        action: "POST /admin/cp/ai/orders/:id/cancel",
        resource_id: third.id,
        outcome: 200,
      })
      expect(plain.map((row) => row.changes)).toEqual([
        expect.objectContaining({ order: { tenant_id: made.id, to: "cancelled", credits: 500 } }),
      ])
    })

    it("says the shop's flag, status and month's grant, and names each row's staff member", async () => {
      const plain = await makeTenant(http, owner)
      const bare = await call.get(`/admin/cp/tenants/${plain.id}/ai-credits`, owner)
      const status = (
        (await call.get(`/admin/cp/tenants/${plain.id}`, owner)).data as {
          tenant: { status: string }
        }
      ).tenant.status
      // No package: no flag, no grant
      expect(bare.data).toMatchObject({ flag_on: false, tenant_status: status, monthly_grant: 0 })

      const shop = await aiShop(http, getContainer(), owner, { monthly: 250 })
      const W = `/admin/cp/tenants/${shop.id}/ai-credits`
      const other = await makeMember(http, getContainer(), "owner")
      const adjust = { amount: 40, bucket: "purchased", note: "Düzeltme" }
      expect((await post(`${W}/adjust`, { ...adjust, key: adjustKey() })).status).toBe(200)
      expect((await postAs(other, `${W}/adjust`, { ...adjust, key: adjustKey() })).status).toBe(200)
      // A staff member removed: their id stays on the row, their name is gone
      await getContainer().resolve(Modules.USER).deleteUsers([other.userId])

      const read = await call.get(W, owner)
      expect(read.data).toMatchObject({
        flag_on: true,
        tenant_status: "active",
        monthly_grant: 250,
        balance: { plan: { balance: 250 } },
      })
      const entries = (
        read.data as { entries: { kind: string; actor: string; actor_name: string | null }[] }
      ).entries
      expect(entries.map(({ kind, actor, actor_name }) => [kind, actor, actor_name])).toEqual([
        ["adjust", other.userId, null],
        ["adjust", owner.userId, owner.email],
        ["grant_plan_monthly", "system", null],
      ])

      // The flag off for the shop, whatever its status: said apart from it
      const off = await aiShop(http, getContainer(), owner, { flag: false, status: "restricted" })
      expect((await call.get(`/admin/cp/tenants/${off.id}/ai-credits`, owner)).data).toMatchObject({
        flag_on: false,
        tenant_status: "restricted",
        monthly_grant: 100,
      })
      const on = await aiShop(http, getContainer(), owner, { status: "suspended" })
      expect((await call.get(`/admin/cp/tenants/${on.id}/ai-credits`, owner)).data).toMatchObject({
        flag_on: true,
        tenant_status: "suspended",
      })
    })
  },
})
