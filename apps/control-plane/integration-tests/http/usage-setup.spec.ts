import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { fleetOf, shopKey, signedPost } from "../helpers/fleet"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const USAGE = "/tenant-api/v1/usage"

const SETUP = {
  store_named: true,
  currency: true,
  region: true,
  stock_location: true,
  shipping: true,
  payment: false,
  product_published: true,
  look_published: false,
  legal_published: false,
  mail_sender: false,
}

const reportOf = (tenantId: string, at: Date, changes: Record<string, unknown> = {}) => ({
  version: 1,
  tenant_id: tenantId,
  reported_at: at.toISOString(),
  period: usagePeriodOf(at),
  counts: { products: 4, orders_this_month: 0, staff: 1, storage_mb: 2, llm_credits_this_month: 0 },
  last_order_at: null,
  release: { version: "1.5.0", commit: "abcdef0" },
  ...changes,
})

/**
 * adr/0061 Ek C21: the usage report's optional setup checklist. A report
 * with it is stored and its yes/no facts shown on the shop's page and in
 * the list; one without it (an older shop) is taken all the same; a
 * checklist carrying anything but the contract's yes/no is refused whole.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      readonly = await makeMember(http, getContainer(), "readonly")
    })

    async function shop(): Promise<{ id: string; slug: string; signer: Ed25519Signer }> {
      const tenant = await makeTenant(http, owner)
      return { ...tenant, signer: await shopKey(getContainer(), tenant.id) }
    }

    const send = (tenantId: string, signer: Ed25519Signer, body: unknown) => {
      const raw = JSON.stringify(body)
      return http.post<{ message?: string; stored?: boolean }>(USAGE, raw, {
        ...anyStatus,
        headers: signedPost(USAGE, tenantId, signer, raw),
      })
    }

    it("stores the checklist and shows it on the shop's page and in the list", async () => {
      const a = await shop()
      const sent = await send(a.id, a.signer, reportOf(a.id, new Date(), { setup: SETUP }))
      expect([sent.status, sent.data]).toEqual([200, { stored: true }])
      expect((await fleetOf(getContainer()).latestUsage(a.id))?.setup).toEqual(SETUP)

      const page = await call.get(`/admin/cp/tenants/${a.id}/usage-health`, readonly)
      expect(page.status).toBe(200)
      expect((page.data as { setup: unknown }).setup).toEqual({
        setup: SETUP,
        received_at: expect.any(String) as unknown,
      })
      const list = await call.get(`/admin/cp/tenants?q=${a.slug}`, readonly)
      expect((list.data as { tenants: { id: string; setup: unknown }[] }).tenants).toEqual([
        expect.objectContaining({ id: a.id, setup: SETUP }),
      ])

      // A later report without it (its read failed that hour) keeps the last known one
      const fleet = fleetOf(getContainer())
      const [stored] = await fleet.listUsageSnapshots({ tenant_id: a.id }, { take: 1 })
      await fleet.updateUsageSnapshots({
        id: (stored as { id: string }).id,
        received_at: new Date(Date.now() - 11 * 60_000),
        reported_at: new Date(Date.now() - 11 * 60_000),
      })
      expect((await send(a.id, a.signer, reportOf(a.id, new Date()))).status).toBe(200)
      const after = await call.get(`/admin/cp/tenants/${a.id}/usage-health`, readonly)
      expect((after.data as { setup: { setup: unknown } }).setup.setup).toEqual(SETUP)
      const again = await call.get(`/admin/cp/tenants?q=${a.slug}`, readonly)
      expect((again.data as { tenants: { setup: unknown }[] }).tenants[0]?.setup).toEqual(SETUP)
    })

    it("takes an older shop's report without it, and shows none", async () => {
      const b = await shop()
      expect((await send(b.id, b.signer, reportOf(b.id, new Date()))).status).toBe(200)
      expect((await fleetOf(getContainer()).latestUsage(b.id))?.setup).toBeNull()
      const page = await call.get(`/admin/cp/tenants/${b.id}/usage-health`, readonly)
      expect((page.data as { setup: unknown }).setup).toBeNull()
      const list = await call.get(`/admin/cp/tenants?q=${b.slug}`, readonly)
      expect((list.data as { tenants: { setup: unknown }[] }).tenants[0]?.setup).toBeNull()
    })

    it("refuses a checklist with more than yes and no, and stores nothing", async () => {
      const c = await shop()
      for (const setup of [
        { ...SETUP, payment: "paytr" },
        { ...SETUP, owner_email: true },
        { ...SETUP, product_published: 12 },
      ]) {
        const answer = await send(c.id, c.signer, reportOf(c.id, new Date(), { setup }))
        expect([answer.status, answer.data.message]).toEqual([400, "usage.invalid"])
      }
      expect(await fleetOf(getContainer()).latestUsage(c.id)).toBeNull()
    })
  },
})
