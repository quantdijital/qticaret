import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { addDays, dayOfMonth, periodEnd } from "../../src/lib/billing/days"
import { runBilling } from "../../src/lib/billing/run"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { changeChargeWorkflow } from "../../src/workflows/billing/workflows"
import { at, billingOf, billingShop, chargesOf, day, mailbox, runAt } from "../helpers/billing"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

/**
 * adr/0061 §7, Ek C16: a subscription's life with the clock moved by the
 * test (`runBilling(container, now)`), never slept: its start and trial,
 * its periods and their charges, a price change from the next period, the
 * reminders once each on Istanbul's days and hours, the grace's end
 * restricting the shop (never suspending it) and its document saying so.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let finance: Member
    let operator: Member

    beforeAll(async () => {
      finance = await makeMember(http, getContainer(), "finance")
      operator = await makeMember(http, getContainer(), "operator")
      await ensureSigningKey(getContainer())
    })

    const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
    const latest = async (id: string) =>
      (await fleetOf(getContainer()).latestPlanDocument(id))?.document
    const shop = (terms: Parameters<typeof billingShop>[3] = {}) =>
      billingShop(http, getContainer(), { finance, operator }, terms)

    it("starts with the trial: its first charge due at the trial's end, the document says so", async () => {
      const { id } = await shop({ price: 49_000, trial_days: 14 })
      const d0 = day(0)
      const box = mailbox()

      const run = await runAt(getContainer(), at(d0, 10), box)

      expect(run.started).toBeGreaterThanOrEqual(1)
      const sub = await billingOf(getContainer()).subscriptionOf(id)
      expect(sub).toMatchObject({
        status: "trialing",
        started_on: d0,
        trial_ends_on: addDays(d0, 14),
        current_period_end: addDays(d0, 14),
        price: 49_000,
        grace_days: 7,
      })
      const [first, ...rest] = await chargesOf(getContainer(), id)
      expect(rest).toHaveLength(0)
      expect(first).toMatchObject({
        status: "open",
        amount: 49_000,
        due_on: addDays(d0, 14),
        period_start: addDays(d0, 14),
      })
      expect((await latest(id))?.billing).toEqual({
        status: "trialing",
        due_on: addDays(d0, 14),
        grace_ends_on: null,
        amount: 49_000,
        currency: "TRY",
        package_name: "Profesyonel Ağ",
        payment_instruction: null,
      })
    })

    it("sends each reminder once, on Istanbul's day, from 09:00, even run twice at once", async () => {
      const { id, email } = await shop({ trial_days: 14 })
      const d0 = day(0)
      const due = addDays(d0, 14)
      const box = mailbox()

      await runAt(getContainer(), at(d0, 8, 59), box)
      expect(box.to(email)).toHaveLength(0)
      await runAt(getContainer(), at(d0, 9, 0), box)
      await runAt(getContainer(), at(d0, 23, 59), box)
      expect(box.to(email).map((each) => each.template)).toEqual(["cp.billing_before_14"])

      // 20:59 UTC on day 6 is still its Istanbul day; 21:00 UTC is day 7 (before_7)
      await runAt(getContainer(), new Date(`${addDays(d0, 6)}T20:59:00Z`), box)
      expect(box.to(email)).toHaveLength(1)
      await Promise.all([
        runAt(getContainer(), new Date(`${addDays(d0, 6)}T21:00:00Z`), box),
        runAt(getContainer(), new Date(`${addDays(d0, 6)}T21:00:00Z`), box),
      ])
      // 00:00 Istanbul: the day turned, but reminders wait for nine
      expect(box.to(email)).toHaveLength(1)
      await Promise.all([
        runAt(getContainer(), at(addDays(d0, 7), 9, 30), box),
        runAt(getContainer(), at(addDays(d0, 7), 9, 30), box),
      ])
      for (const offset of [11, 13, 14, 15, 17]) {
        await runAt(getContainer(), at(addDays(d0, offset), 9, 5), box)
        await runAt(getContainer(), at(addDays(d0, offset), 15, 0), box)
      }

      expect(box.to(email).map((each) => each.template)).toEqual([
        "cp.billing_before_14",
        "cp.billing_before_7",
        "cp.billing_before_3",
        "cp.billing_before_1",
        "cp.billing_due",
        "cp.billing_overdue_3",
      ])
      expect(box.to(email)[4]?.subject).toContain("ödeme günü bugün")
      const reminders = await billingOf(getContainer()).remindersOf(id)
      expect(reminders).toHaveLength(6)
      expect(reminders.every((each) => each.outcome === "sent")).toBe(true)
      expect(due).toBe(addDays(d0, 14))
    })

    it("rolls at the trial's end, opens the next charge 14 days ahead; a price change waits", async () => {
      const { id, packageId } = await shop({ price: 49_000, trial_days: 14 })
      const d0 = day(-40)
      const box = mailbox()
      await runAt(getContainer(), at(d0, 10), box)
      const paidFrom = addDays(d0, 14)
      const next = periodEnd(paidFrom, "monthly", dayOfMonth(paidFrom))

      await runAt(getContainer(), at(paidFrom, 10), box)
      const [first] = await chargesOf(getContainer(), id)
      await changeChargeWorkflow(getContainer()).run({
        input: {
          tenant_id: id,
          charge_id: first?.id ?? "",
          today: paidFrom,
          change: {
            kind: "pay",
            paid_on: paidFrom,
            method: "bank_transfer",
            reference: "DEKONT-2611",
            actor: finance.userId,
          },
        },
      })
      const priced = await call.post(
        `/admin/cp/plans/${packageId}/price`,
        { price: 99_000, period: "monthly" },
        finance,
        await proved(http, finance)
      )
      expect(priced.status).toBe(200)

      expect(await billingOf(getContainer()).subscriptionOf(id)).toMatchObject({
        status: "active",
        price: 49_000,
        current_period_start: paidFrom,
        current_period_end: next,
      })
      await runAt(getContainer(), at(addDays(next, -15), 10), box)
      expect(await chargesOf(getContainer(), id)).toHaveLength(1)
      await runAt(getContainer(), at(addDays(next, -14), 10), box)
      const charges = await chargesOf(getContainer(), id)
      expect(charges).toHaveLength(2)
      expect(charges[1]).toMatchObject({
        status: "open",
        due_on: next,
        amount: 99_000,
        list_amount: 99_000,
      })
      // The running period keeps its price; the next one takes the new
      expect((await billingOf(getContainer()).subscriptionOf(id))?.price).toBe(49_000)
      await runAt(getContainer(), at(next, 10), box)
      expect(await billingOf(getContainer()).subscriptionOf(id)).toMatchObject({
        price: 99_000,
        current_period_start: next,
        status: "past_due",
      })
      // A run again the same day opens nothing more
      await runAt(getContainer(), at(next, 16), box)
      expect(await chargesOf(getContainer(), id)).toHaveLength(2)
    })

    it("restricts the shop when its grace ends, never suspends it, and says so once", async () => {
      const { id, email } = await shop({ grace_days: 7 })
      const d0 = day(-20)
      const box = mailbox()
      await runAt(getContainer(), at(d0, 10), box)
      const graceEnds = addDays(d0, 7)

      await runAt(getContainer(), at(graceEnds, 10), box)
      expect((await tenants().tenantOf(id)).status).toBe("active")
      expect((await latest(id))?.billing).toMatchObject({
        status: "past_due",
        due_on: d0,
        grace_ends_on: graceEnds,
      })
      const before = (await fleetOf(getContainer()).latestPlanDocument(id))?.serial ?? 0

      const run = await runAt(getContainer(), at(addDays(graceEnds, 1), 10), box)
      await runAt(getContainer(), at(addDays(graceEnds, 1), 18), box)
      await runAt(getContainer(), at(addDays(graceEnds, 30), 10), box)

      expect(run.restricted).toBeGreaterThanOrEqual(1)
      expect((await tenants().tenantOf(id)).status).toBe("restricted")
      const [row] = await tenants().listTenantStatusChanges(
        { tenant_id: id, to_status: "restricted" },
        { take: 5 }
      )
      expect(row).toMatchObject({
        from_status: "active",
        reason_code: "payment_overdue",
        actor: "system",
      })
      const document = await fleetOf(getContainer()).latestPlanDocument(id)
      expect(document?.serial).toBeGreaterThan(before)
      expect(document?.document).toMatchObject({
        status: "restricted",
        billing: { status: "restricted", due_on: d0, grace_ends_on: graceEnds },
      })
      expect(
        box.to(email).filter((each) => each.template === "cp.billing_restricted")
      ).toHaveLength(1)
      expect(
        await tenants().listTenantStatusChanges({ tenant_id: id, to_status: "suspended" })
      ).toHaveLength(0)
    })

    it("keeps a reminder that cannot go, without sending it later", async () => {
      const { id } = await shop({ trial_days: 14 })
      await tenants().updateTenantContacts({
        selector: { tenant_id: id },
        data: { email: "x@y.z" },
      })
      const d0 = day(0)

      // No transport (tests send no mail): claimed and kept as skipped
      await runBilling(getContainer(), at(d0, 10))
      await runBilling(getContainer(), at(d0, 11))

      const reminders = await billingOf(getContainer()).remindersOf(id)
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toMatchObject({
        kind: "before_14",
        outcome: "skipped",
        error_code: "billing.mail_off",
      })
    })
  },
})
