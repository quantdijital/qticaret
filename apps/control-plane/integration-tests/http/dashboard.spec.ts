import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { PLANS_MODULE } from "../../src/modules/plans"
import type PlansModuleService from "../../src/modules/plans/service"
import { billingOf, day } from "../helpers/billing"
import { fleetOf } from "../helpers/fleet"
import { failProbes, moveThrough, reportAt, tenantsOf } from "../helpers/releases"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, freshSlug, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const COMMIT = "8a128bbe0c3d4e5f60718293a4b5c6d7e8f90a1b"
const HOUR = 60 * 60 * 1000

interface Terms {
  status: "trialing" | "active" | "past_due" | "restricted"
  period?: "monthly" | "yearly"
  price: number
  /** Days from today the running period ends (the next one's first day). */
  ends: number
  grace?: number
}

interface OpenCharge {
  due: number
  amount: number
  /** The period it is for starts on its due day; true when that is the next period. */
  next?: boolean
}

/** A package at `price` (straight in the module): its id. */
const packageAt = (container: MedusaContainer, price: number) =>
  container.resolve<PlansModuleService>(PLANS_MODULE).createPackage({
    code: freshSlug("paket"),
    name: "Paket",
    price,
    period: "monthly",
    trial_days: 0,
    grace_days: 7,
    limits: {},
  })

/** A subscription and its open charges as billing would have left them (days from today). */
async function subscribe(
  container: MedusaContainer,
  tenantId: string,
  packageId: string,
  terms: Terms,
  charges: OpenCharge[] = []
) {
  const billing = billingOf(container)
  const period = terms.period ?? "monthly"
  const [sub] = await billing.createSubscriptions([
    {
      tenant_id: tenantId,
      package_id: packageId,
      price: terms.price,
      period,
      started_on: day(-60),
      trial_ends_on: terms.status === "trialing" ? day(terms.ends) : null,
      current_period_start: day(terms.ends - 30),
      current_period_end: day(terms.ends),
      anchor_day: 1,
      grace_days: terms.grace ?? 7,
      status: terms.status,
    },
  ])
  for (const charge of charges) {
    await billing.createCharges([
      {
        subscription_id: sub?.id ?? "",
        tenant_id: tenantId,
        period,
        period_start: day(charge.next ? terms.ends : charge.due),
        period_end: day((charge.next ? terms.ends : charge.due) + 30),
        amount: charge.amount,
        list_amount: charge.amount,
        due_on: day(charge.due),
        status: "open",
      },
    ])
  }
}

/**
 * adr/0061 C18, Ek C18: the dashboard. Shops by status; monthly recurring
 * revenue of paying subscriptions of shops still selling (yearly as a
 * twelfth, trials apart); overdue payments as the payments list counts
 * them; renewals in the next 30 days (open charges and periods whose
 * charge is not open yet); unhealthy and silent shops; version drift.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member
    let finance: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
      readonly = await makeMember(http, getContainer(), "readonly")
    })

    it("sums the platform's shops, money and health", async () => {
      const container = getContainer()
      const shop = async (name: string, statuses: TenantStatus[]) => {
        const made = await makeTenant(http, operator, { name })
        await moveThrough(container, made.id, statuses)
        return made.id
      }
      const [a, b, c, d, e, f, g, h] = [
        await shop("Atölye A", ["active"]),
        await shop("Bıçakçı B", ["active"]),
        await shop("Çelik C", ["active", "restricted"]),
        await shop("Demir D", ["active", "suspended"]),
        await shop("Ege E", ["active"]),
        await shop("Fırın F", ["active"]),
        await shop("Gümüş G", ["active"]),
        await shop("Hasır H", []),
      ]
      const pkg = await packageAt(container, 49_000)
      // A's package costs more now: its next charge (not open yet) will be at this price
      const dearer = await packageAt(container, 120_000)

      await subscribe(container, a, dearer, { status: "active", price: 100_000, ends: 20 })
      await subscribe(
        container,
        b,
        pkg,
        { status: "past_due", period: "yearly", price: 1_190_000, ends: 60, grace: 30 },
        [{ due: -10, amount: 1_190_000 }]
      )
      await subscribe(container, c, pkg, { status: "restricted", price: 50_000, ends: 60 }, [
        { due: -40, amount: 50_000 },
      ])
      // Suspended: not recurring revenue now; its renewal (the window's last day) still counts
      await subscribe(container, d, pkg, { status: "active", price: 70_000, ends: 29 }, [
        { due: 29, amount: 70_000, next: true },
      ])
      // In its trial: apart; its first charge is due a day after the window
      await subscribe(container, e, pkg, { status: "trialing", price: 49_000, ends: 30 }, [
        { due: 30, amount: 49_000, next: true },
      ])
      // Closed: nothing of it counts
      await subscribe(container, f, pkg, { status: "active", price: 999_000, ends: 5 })
      // Due today (in the window); its next period starts a day after the window
      await subscribe(container, g, pkg, { status: "active", price: 10_000, ends: 30 }, [
        { due: 0, amount: 10_000 },
      ])

      // Health: A's backend unhealthy, G's storefront failing once, D (not probed) ignored
      await failProbes(container, a, "backend", 3)
      await failProbes(container, g, "storefront", 1)
      await failProbes(container, d, "backend", 3)
      // Reports: A last 4 hours ago (silent), G an hour ago, E never since 5 hours, B never but just now
      const tenants = tenantsOf(container)
      for (const id of [a, b, e, g]) {
        await tenants.updateTenants({ id, api_base_url: "http://127.0.0.1:9201" })
      }
      await tenants.updateTenants({ id: e, status_changed_at: new Date(Date.now() - 5 * HOUR) })
      const fleet = fleetOf(container)
      const release = await fleet.addRelease({
        version: "1.4.0",
        commit: COMMIT,
        notes: null,
        created_by: owner.userId,
      })
      await reportAt(container, a, new Date(Date.now() - 4 * HOUR), {
        version: "1.4.0",
        commit: COMMIT.slice(0, 8),
      })
      await reportAt(container, g, new Date(Date.now() - HOUR), {
        version: "1.3.0",
        commit: "1234567",
      })
      await reportAt(container, f, new Date(Date.now() - HOUR), {
        version: "1.3.0",
        commit: "1234567",
      })
      for (const id of [a, e, f, g]) {
        await fleet.setTarget({
          tenant_id: id,
          release_id: release.id,
          actor: owner.userId,
          reason: "Pilot",
        })
      }
      // F closes after its target was set (a closed shop's target never changes, review L2)
      await moveThrough(container, f, ["closing", "closed"])

      const answer = await call.get("/admin/cp/dashboard", readonly)

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      const board = answer.data
      expect(board["shops"]).toEqual({
        active: 4,
        restricted: 1,
        suspended: 1,
        provisioning: 1,
        total: 7,
      })
      // A 100.000 + B 1.190.000 / 12 = 99.166,67 → 99.167 + C 50.000 + G 10.000
      expect(board["revenue"]).toEqual({
        mrr: 259_167,
        paying_count: 4,
        trial: { count: 1, mrr: 49_000 },
        currency_code: "TRY",
      })
      expect(board["overdue"]).toMatchObject({
        count: 2,
        total: 1_240_000,
        oldest: [
          { tenant: { id: c, name: "Çelik C" }, due_on: day(-40), amount: 50_000 },
          { tenant: { id: b }, due_on: day(-10), amount: 1_190_000 },
        ],
      })
      // The payments screen's overdue list: the same count
      const overdueList = await call.get("/admin/cp/payments?view=overdue", readonly)
      expect((overdueList.data as { count: number }).count).toBe(2)
      const renewals = board["renewals"] as Record<string, unknown> & {
        next: {
          tenant: { id: string }
          charge_id: string | null
          due_on: string
          amount: number
          projected: boolean
        }[]
      }
      expect({ ...renewals, next: undefined }).toEqual({
        days: 30,
        from: day(0),
        to: day(29),
        count: 3,
        total: 200_000,
        open: { count: 2, total: 80_000 },
        projected: { count: 1, total: 120_000 },
        next: undefined,
      })
      expect(
        renewals.next.map((row) => [
          row.tenant.id,
          row.due_on,
          row.amount,
          row.projected,
          row.charge_id === null,
        ])
      ).toEqual([
        [g, day(0), 10_000, false, false],
        [a, day(20), 120_000, true, true],
        [d, day(29), 70_000, false, false],
      ])
      expect(board["health"]).toMatchObject({
        unhealthy: 1,
        failing: 1,
        stale: 2,
        stale_after_hours: 3,
        drift: 1,
        shops: [
          {
            tenant: { id: a, name: "Atölye A" },
            problem: "unhealthy",
            target: "backend",
            error: "health.http_503",
          },
          { tenant: { id: e }, problem: "stale", target: null },
        ],
      })
      expect(JSON.stringify(board)).not.toContain("@")
      expect(h).toBeTruthy()
    })

    it.each(["owner", "operator", "finance", "readonly"] as const)(
      "lets %s read it, and takes no query",
      async (role) => {
        const member = { owner, operator, finance, readonly }[role]

        expect((await call.get("/admin/cp/dashboard", member)).status).toBe(200)
        expect((await call.get("/admin/cp/dashboard?from=2026-01-01", member)).status).toBe(400)
      }
    )
  },
})
