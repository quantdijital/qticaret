import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { probeFleet } from "../../src/lib/fleet/health-probe"
import { parseTenantApiHosts } from "../../src/lib/fleet/push-target"
import { pruneFleetHistory } from "../../src/jobs/fleet-retention"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { fleetOf, shopKey, signedGet, signedPost } from "../helpers/fleet"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const USAGE = "/tenant-api/v1/usage"

const reportOf = (tenantId: string, at: Date, changes: Record<string, unknown> = {}) => ({
  version: 1,
  tenant_id: tenantId,
  reported_at: at.toISOString(),
  period: usagePeriodOf(at),
  counts: {
    products: 42,
    orders_this_month: 7,
    staff: 2,
    storage_mb: 120,
    llm_credits_this_month: 3,
  },
  last_order_at: new Date(at.getTime() - 3600_000).toISOString(),
  release: { version: "1.4.0", commit: "0123456789abcdef0123456789abcdef01234567" },
  ...changes,
})

/** A stand-in shop: `/health` answers as `mode` says; `/` is its storefront. */
function fakeShop() {
  const state = { mode: "ok" as "ok" | "down" | "hang" | "redirect", seen: [] as string[] }
  const server = createServer((req, res) => {
    state.seen.push(req.url ?? "")
    if (state.mode === "hang") {
      return
    }
    if (state.mode === "redirect") {
      res.writeHead(302, { location: "http://169.254.169.254/" }).end()
      return
    }
    res.writeHead(state.mode === "ok" ? 200 : 503).end()
  })
  return { server, state }
}

const listen = (server: Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port)
    })
  })

/**
 * adr/0061 §3.1, §5.4, Ek C13: the shops' signed hourly usage report and
 * the control plane's health probe. A report is taken only signed by the
 * shop over its exact bytes, once (nonce), fresh, strictly the contract's
 * fields, about the signer itself and newer than the last; the probe
 * marks a shop unhealthy at the third failure and follows no redirect.
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

    const post = (headers: Record<string, string>, body: string, path = USAGE) =>
      http.post<{ message?: string; stored?: boolean }>(path, body, { ...anyStatus, headers })

    async function shop(): Promise<{ id: string; slug: string; signer: Ed25519Signer }> {
      const tenant = await makeTenant(http, owner)
      return { ...tenant, signer: await shopKey(getContainer(), tenant.id) }
    }

    const send = (tenantId: string, signer: Ed25519Signer, body: unknown) => {
      const raw = JSON.stringify(body)
      return post(signedPost(USAGE, tenantId, signer, raw), raw)
    }

    it("stores a signed report, one per ten minutes, and the shop page shows the latest", async () => {
      const a = await shop()
      const first = await send(a.id, a.signer, reportOf(a.id, new Date(Date.now() - 60_000)))
      expect([first.status, first.data]).toEqual([200, { stored: true }])
      expect(first.headers["cache-control"]).toBe("no-store")
      const now = new Date()
      const newer = reportOf(a.id, now, { counts: { ...reportOf(a.id, now).counts, products: 43 } })
      // Review M1: a newer report minutes after the last is refused, nothing written
      const soon = await send(a.id, a.signer, newer)
      expect([soon.status, soon.data.message]).toEqual([409, "usage.too_soon"])
      expect((await fleetOf(getContainer()).latestUsage(a.id))?.products).toBe(42)
      // Eleven minutes on (by our clock), it is taken
      const fleet = fleetOf(getContainer())
      const [stored] = await fleet.listUsageSnapshots({ tenant_id: a.id }, { take: 1 })
      await fleet.updateUsageSnapshots({
        id: (stored as { id: string }).id,
        received_at: new Date(Date.now() - 11 * 60_000),
      })
      expect((await send(a.id, a.signer, newer)).status).toBe(200)

      const latest = await fleetOf(getContainer()).latestUsage(a.id)
      expect(latest).toMatchObject({
        tenant_id: a.id,
        products: 43,
        staff: 2,
        period: usagePeriodOf(now),
      })
      // Every role reads it: totals only, nothing personal
      for (const member of [owner, readonly]) {
        const page = await call.get(`/admin/cp/tenants/${a.id}/usage-health`, member)
        expect(page.status).toBe(200)
        expect(page.data).toMatchObject({
          usage: {
            reported_at: now.toISOString(),
            counts: { products: 43, orders_this_month: 7, staff: 2, storage_mb: 120 },
            release: { version: "1.4.0" },
          },
          report: { expected: false, missing: false },
          health: { backend: { probed: false, standing: null }, storefront: { probed: false } },
        })
      }
    })

    it("refuses a replayed nonce, a stale signature and a bad one", async () => {
      const a = await shop()
      const raw = JSON.stringify(reportOf(a.id, new Date()))
      const headers = signedPost(USAGE, a.id, a.signer, raw)
      expect((await post(headers, raw)).status).toBe(200)
      const replay = await post(headers, raw)
      expect([replay.status, replay.data.message]).toEqual([401, "signature.replayed"])

      const old = signedPost(USAGE, a.id, a.signer, raw, { now: Date.now() - 6 * 60_000 })
      expect((await post(old, raw)).data.message).toBe("signature.stale")
      // The signature covers the bytes: another body under good headers fails
      const fresh = JSON.stringify(reportOf(a.id, new Date(Date.now() + 1000)))
      const moved = await post(signedPost(USAGE, a.id, a.signer, fresh), fresh.replace("42", "41"))
      expect([moved.status, moved.data.message]).toEqual([401, "signature.invalid"])
    })

    it("refuses an old, a future, an older and an equal report", async () => {
      const a = await shop()
      const now = Date.now()
      for (const offset of [-10 * 60_000, 10 * 60_000]) {
        const answer = await send(a.id, a.signer, reportOf(a.id, new Date(now + offset)))
        expect([answer.status, answer.data.message]).toEqual([400, "usage.stale"])
      }
      const at = new Date(now)
      expect((await send(a.id, a.signer, reportOf(a.id, at))).status).toBe(200)
      for (const when of [at, new Date(now - 60_000)]) {
        const answer = await send(
          a.id,
          a.signer,
          reportOf(a.id, when, { counts: { ...reportOf(a.id, when).counts, staff: 9 } })
        )
        expect([answer.status, answer.data.message]).toEqual([409, "usage.out_of_order"])
      }
      expect((await fleetOf(getContainer()).latestUsage(a.id))?.staff).toBe(2)
    })

    it("refuses an unknown field, another shop's id, a non-JSON body and one over 4 KB", async () => {
      const a = await shop()
      const b = await shop()
      const now = new Date()
      for (const body of [
        reportOf(a.id, now, { revenue: 125_000 }),
        reportOf(a.id, now, { counts: { ...reportOf(a.id, now).counts, customers: 5 } }),
        reportOf(a.id, now, { contact: { email: "ayse@example.com" } }),
      ]) {
        const answer = await send(a.id, a.signer, body)
        expect([answer.status, answer.data.message]).toEqual([400, "usage.invalid"])
      }
      // A's key, a report about B: refused
      const other = await send(a.id, a.signer, reportOf(b.id, now))
      expect([other.status, other.data.message]).toEqual([403, "usage.wrong_tenant"])
      // A's key under B's id: not a signature B made
      const raw = JSON.stringify(reportOf(b.id, now))
      const posing = await post(signedPost(USAGE, b.id, a.signer, raw), raw)
      expect([posing.status, posing.data.message]).toEqual([401, "signature.invalid"])
      const plain = await post(
        { ...signedPost(USAGE, a.id, a.signer, "x=1"), "content-type": "text/plain" },
        "x=1"
      )
      expect(plain.status).toBe(400)
      const big = JSON.stringify({ ...reportOf(a.id, now), pad: "x".repeat(5000) })
      expect((await post(signedPost(USAGE, a.id, a.signer, big), big)).status).toBe(413)
      expect(await fleetOf(getContainer()).latestUsage(a.id)).toBeNull()
      expect(await fleetOf(getContainer()).latestUsage(b.id)).toBeNull()
    })

    it("limits each shop to 30 signed calls a minute, apart from other shops (review M1)", async () => {
      const a = await shop()
      const b = await shop()
      const plan = (who: { id: string; signer: Ed25519Signer }) =>
        http.get<{ message?: string }>("/tenant-api/v1/plan", {
          ...anyStatus,
          headers: signedGet("/tenant-api/v1/plan", who.id, who.signer),
        })
      for (let i = 0; i < 30; i += 1) {
        expect((await plan(a)).status).not.toBe(429)
      }
      const over = await plan(a)
      expect(over.status).toBe(429)
      expect(over.headers["retry-after"]).toBeDefined()
      // The same address, another shop: its own bucket
      expect((await plan(b)).status).not.toBe(429)
      // Usage counts in the same bucket
      const raw = JSON.stringify(reportOf(a.id, new Date()))
      expect((await post(signedPost(USAGE, a.id, a.signer, raw), raw)).status).toBe(429)
    })

    describe("the health probe", () => {
      let server: Server
      let state: ReturnType<typeof fakeShop>["state"]
      let base: string
      let policy: ReturnType<typeof parseTenantApiHosts>

      beforeAll(async () => {
        const made = fakeShop()
        server = made.server
        state = made.state
        const port = await listen(server)
        base = `http://localhost:${String(port)}`
        policy = parseTenantApiHosts(`localhost:${String(port)}`)
      })
      afterAll(() => {
        server.closeAllConnections()
        server.close()
      })

      const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
      const probe = (slug: string) =>
        probeFleet(getContainer(), {
          slugs: [slug],
          policy: { local: false, hosts: policy },
          timeoutMs: 300,
        })

      it("is healthy, fails, turns unhealthy at the third failure and comes back", async () => {
        const a = await shop()
        await tenants().updateTenants({ id: a.id, api_base_url: base })
        state.mode = "ok"
        state.seen.length = 0
        expect(await probe(a.slug)).toMatchObject({ probed: 1, healthy: 1 })
        expect(state.seen).toEqual(["/health"])

        state.mode = "down"
        expect(await probe(a.slug)).toMatchObject({ failing: 1 })
        state.mode = "hang"
        expect(await probe(a.slug)).toMatchObject({ failing: 1 })
        state.mode = "redirect"
        expect(await probe(a.slug)).toMatchObject({ unhealthy: 1 })
        // The redirect was never followed
        expect(state.seen.filter((path) => path !== "/health")).toEqual([])

        const page = await call.get(`/admin/cp/tenants/${a.id}/usage-health`, readonly)
        const backend = (page.data as { health: { backend: Record<string, unknown> } }).health
          .backend
        expect(backend).toMatchObject({
          probed: true,
          standing: { state: "unhealthy", consecutive_failures: 3, error: "health.redirect" },
          day: { total: 4, ok: 1 },
        })
        expect((backend["history"] as { error: string | null }[]).map((row) => row.error)).toEqual([
          "health.redirect",
          "health.timeout",
          "health.http_503",
          null,
        ])
        const list = await call.get(`/admin/cp/tenants?q=${a.slug}`, readonly)
        expect((list.data as { tenants: { health: unknown }[] }).tenants[0]?.health).toEqual({
          backend: "unhealthy",
          storefront: null,
        })

        state.mode = "ok"
        expect(await probe(a.slug)).toMatchObject({ healthy: 1 })
      })

      it("probes a restricted shop's two targets, a suspended one's backend only, and expects their reports (Ek C19 L2)", async () => {
        const a = await shop()
        await tenants().updateTenants({ id: a.id, api_base_url: base, storefront_url: base })
        state.mode = "ok"
        const page = async () =>
          (await call.get(`/admin/cp/tenants/${a.id}/usage-health`, readonly)).data as {
            report: { expected: boolean }
            health: { backend: { probed: boolean }; storefront: { probed: boolean } }
          }

        await tenants().changeStatus(a.id, "active", { reason_code: "test", actor: "system" })
        await tenants().changeStatus(a.id, "restricted", { reason_code: "test", actor: "system" })
        expect((await probe(a.slug)).probed).toBe(2)
        expect(await page()).toMatchObject({
          report: { expected: true },
          health: { backend: { probed: true }, storefront: { probed: true } },
        })

        await tenants().changeStatus(a.id, "suspended", { reason_code: "test", actor: "system" })
        state.seen.length = 0
        expect(await probe(a.slug)).toMatchObject({ probed: 1, healthy: 1 })
        expect(state.seen).toEqual(["/health"])
        expect(await page()).toMatchObject({
          report: { expected: true },
          health: { backend: { probed: true }, storefront: { probed: false } },
        })
      })

      it("asks nothing of an address outside the policy, and records why", async () => {
        const a = await shop()
        await tenants().updateTenants({ id: a.id, api_base_url: "http://metadata.example.com/" })
        state.seen.length = 0
        expect(await probe(a.slug)).toMatchObject({ probed: 1, failing: 1 })
        const [row] = await fleetOf(getContainer()).healthOf([a.id])
        expect(row).toMatchObject({ state: "failing", error: "health.target_not_allowed" })
        expect(state.seen).toEqual([])
      })

      it("keeps a day of probes and 90 days of usage", async () => {
        const a = await shop()
        await tenants().updateTenants({ id: a.id, api_base_url: base })
        state.mode = "ok"
        await probe(a.slug)
        expect((await send(a.id, a.signer, reportOf(a.id, new Date()))).status).toBe(200)
        expect(await pruneFleetHistory(getContainer())).toEqual({ usage: 0, health: 0 })
        const later = new Date(Date.now() + 25 * 3600_000)
        expect(await pruneFleetHistory(getContainer(), later)).toEqual({ usage: 0, health: 1 })
        // The standing stays: only the history goes
        expect(await fleetOf(getContainer()).healthOf([a.id])).toHaveLength(1)
        const months = new Date(Date.now() + 91 * 24 * 3600_000)
        expect(await pruneFleetHistory(getContainer(), months)).toEqual({ usage: 1, health: 0 })
      })
    })
  },
})
