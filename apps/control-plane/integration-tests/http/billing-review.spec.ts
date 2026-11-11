import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { addDays } from "../../src/lib/billing/days"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { at, billingOf, billingShop, chargesOf, day, mailbox, runAt } from "../helpers/billing"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, proved } from "../helpers/tenants"

jest.setTimeout(300 * 1000)

const PAID = { method: "bank_transfer", reference: "EFT Ayşe Yılmaz TR12 0006" }

/**
 * Ek C16 security review: a billing decision taken on what other changes
 * left (M1: a run and a staff action interleaved end where the payments
 * say, and so does the document); a charge of nothing is never owed (M2);
 * reminders only to active and restricted shops and only for a charge
 * still open (L1, L2); what staff typed only to owner and finance (L3);
 * the payment day's bounds, the instruction's upsert.
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
      await ensureSigningKey(getContainer())
    })

    const tenants = () => getContainer().resolve<TenantsModuleService>(TENANTS_MODULE)
    const statusOf = async (id: string) => (await tenants().tenantOf(id)).status
    const latest = async (id: string) =>
      (await fleetOf(getContainer()).latestPlanDocument(id))?.document
    const shop = (terms: Parameters<typeof billingShop>[3] = {}) =>
      billingShop(http, getContainer(), { finance, operator }, terms)
    const pay = async (id: string, charge: string, body: Record<string, unknown> = {}) =>
      call.post(
        `/admin/cp/tenants/${id}/charges/${charge}/pay`,
        { paid_on: day(0), ...PAID, ...body },
        finance,
        await proved(http, finance)
      )

    /** A shop whose first charge was due 20 days ago, seen in its grace 13 days ago. */
    async function lateShop() {
      const made = await shop()
      const box = mailbox()
      await runAt(getContainer(), at(day(-20), 10), box)
      await runAt(getContainer(), at(day(-13), 10), box)
      const [first] = await chargesOf(getContainer(), made.id)
      return { ...made, first: first?.id ?? "" }
    }

    /** Each status row starts where the one before ended. */
    async function chained(id: string) {
      const rows = await tenants().listTenantStatusChanges(
        { tenant_id: id },
        { order: { created_at: "ASC" }, take: 50 }
      )
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index]?.from_status).toBe(rows[index - 1]?.to_status)
      }
    }

    it("M1: a run and a payment at once end active, the document saying so", async () => {
      for (let round = 0; round < 3; round += 1) {
        const late = await lateShop()
        expect(await statusOf(late.id)).toBe("active")

        const [, paid] = await Promise.all([
          runAt(getContainer(), at(day(0), 10), mailbox()),
          pay(late.id, late.first),
        ])

        expect(paid.status).toBe(200)
        expect(await statusOf(late.id)).toBe("active")
        await chained(late.id)
        const sub = await billingOf(getContainer()).subscriptionOf(late.id)
        expect(sub?.status).not.toBe("restricted")
        // The last document follows the last change (issued under the shop's document lock)
        await runAt(getContainer(), at(day(0), 11), mailbox())
        expect(await latest(late.id)).toMatchObject({
          status: "active",
          billing: { status: sub?.status },
        })
      }
    })

    it("M1: a run and a grace taken away at once end restricted, the document saying so", async () => {
      for (let round = 0; round < 3; round += 1) {
        const late = await lateShop()
        const path = `/admin/cp/tenants/${late.id}/subscription`
        await call.post(
          path,
          { grace_days: 30, reason: "Bayram tatili" },
          finance,
          await proved(http, finance)
        )
        await runAt(getContainer(), at(day(0), 10), mailbox())
        expect(await statusOf(late.id)).toBe("active")

        await Promise.all([
          runAt(getContainer(), at(day(0), 12), mailbox()),
          call.post(path, { grace_days: null }, finance, await proved(http, finance)),
        ])

        expect(await statusOf(late.id)).toBe("restricted")
        await chained(late.id)
        expect(await latest(late.id)).toMatchObject({
          status: "restricted",
          billing: { status: "restricted" },
        })
      }
    })

    it("M1: a suspension ending while a payment lands reads the payments as they end", async () => {
      const late = await lateShop()
      await runAt(getContainer(), at(day(0), 10), mailbox())
      expect(await statusOf(late.id)).toBe("restricted")
      await call.post(
        `/admin/cp/tenants/${late.id}/suspend`,
        { reason: "Ödeme takibi" },
        owner,
        await proved(http, owner)
      )
      const proof = await proved(http, owner)

      await Promise.all([
        pay(late.id, late.first),
        call.post(`/admin/cp/tenants/${late.id}/resume`, { reason: "Görüşüldü" }, owner, proof),
      ])

      // Whichever went first: once both are done, a paid shop is never left restricted
      const status = await statusOf(late.id)
      if (status === "restricted") {
        throw new Error("a paid shop was left restricted")
      }
      expect(status).toBe("active")
      await chained(late.id)
    })

    it("M2: a free package's charge is waived as it opens: never reminded, never restricted", async () => {
      const free = await shop({ price: 0 })
      const box = mailbox()
      await runAt(getContainer(), at(day(-40), 10), box)
      for (const offset of [-33, -32, -20, -10, 0]) {
        await runAt(getContainer(), at(day(offset), 10), box)
      }

      const charges = await chargesOf(getContainer(), free.id)
      expect(charges.length).toBeGreaterThanOrEqual(2)
      for (const each of charges) {
        expect(each).toMatchObject({
          amount: 0,
          status: "waived",
          settle_reason: "billing.zero_amount",
        })
      }
      expect(await statusOf(free.id)).toBe("active")
      expect(box.to(free.email)).toHaveLength(0)
      expect((await billingOf(getContainer()).subscriptionOf(free.id))?.status).toBe("active")

      const late = await lateShop()
      const zero = await call.post(
        `/admin/cp/tenants/${late.id}/charges/${late.first}/amount`,
        { amount: 0, reason: "Ücretsiz ay" },
        finance,
        await proved(http, finance)
      )
      expect(zero.status).toBe(400)
      expect(JSON.stringify(zero.data)).toContain("cp.amount_zero")
    })

    it("L1: a suspended shop is billed but not reminded; one being closed is not billed", async () => {
      const suspended = await shop({ trial_days: 14 })
      const closing = await shop({ trial_days: 14 })
      const box = mailbox()
      await runAt(getContainer(), at(day(0), 8), box)
      for (const id of [suspended.id, closing.id]) {
        await tenants().changeStatus(id, id === suspended.id ? "suspended" : "closing", {
          reason_code: "staff_suspend",
          actor: "system",
        })
      }

      for (const offset of [0, 7, 14, 40]) {
        await runAt(getContainer(), at(day(offset), 10), box)
      }

      expect(box.to(suspended.email)).toHaveLength(0)
      expect(box.to(closing.email)).toHaveLength(0)
      // The suspended shop's periods go on; the closing one's stopped where it was
      expect((await chargesOf(getContainer(), suspended.id)).length).toBeGreaterThan(1)
      expect(await chargesOf(getContainer(), closing.id)).toHaveLength(1)
      expect(await billingOf(getContainer()).remindersOf(suspended.id)).toHaveLength(0)
    })

    it("L2: no reminder is claimed for a charge already settled, nor `restricted` before it is", async () => {
      const late = await lateShop()
      const billing = billingOf(getContainer())

      expect(await billing.claimReminder(late.first, late.id, "restricted")).toBeNull()
      expect(await billing.claimReminder(late.first, late.id, "before_1")).toEqual(
        expect.stringMatching(/^rem_/)
      )
      await pay(late.id, late.first)
      expect(await billing.claimReminder(late.first, late.id, "overdue_3")).toBeNull()
      // Another shop's id with this charge claims nothing either
      expect(await billing.claimReminder(late.first, "ten_other", "due")).toBeNull()
    })

    it("L3: references and reasons go to owner and finance only", async () => {
      const late = await lateShop()
      await pay(late.id, late.first)
      await call.post(
        `/admin/cp/tenants/${late.id}/subscription`,
        { grace_days: 10, reason: "Sahibiyle görüşüldü" },
        finance,
        await proved(http, finance)
      )
      const path = `/admin/cp/tenants/${late.id}/subscription`

      for (const member of [owner, finance]) {
        const seen = JSON.stringify((await call.get(path, member)).data)
        expect(seen).toContain(PAID.reference)
        expect(seen).toContain("Sahibiyle görüşüldü")
      }
      for (const member of [operator, readonly]) {
        const answer = await call.get(path, member)
        expect(answer.status).toBe(200)
        const seen = JSON.stringify(answer.data)
        expect(seen).not.toContain(PAID.reference)
        expect(seen).not.toContain("Sahibiyle görüşüldü")
        expect(answer.data).toMatchObject({
          subscription: { grace_override_reason: null, grace_days_override: 10 },
          charges: [{ status: "paid", reference: null, settle_reason: null }],
        })
      }
    })

    it("bounds the payment day: not after today, not 60 days before the period", async () => {
      const late = await lateShop()
      const early = await pay(late.id, late.first, { paid_on: addDays(day(-20), -61) })
      const edge = await pay(late.id, late.first, { paid_on: addDays(day(-20), -60) })

      expect(early.status).toBe(400)
      expect(early.data).toMatchObject({ message: "cp.paid_on_too_early" })
      expect(edge.status).toBe(200)
    })

    it("saves the first instruction twice at once without a conflict; search never cuts silently", async () => {
      const billing = billingOf(getContainer())
      const [first, second] = await Promise.all([
        billing.setPaymentInstruction("IBAN: TR12 A", owner.userId),
        billing.setPaymentInstruction("IBAN: TR12 B", owner.userId),
      ])
      expect([first, second]).toContain(null)
      expect(["IBAN: TR12 A", "IBAN: TR12 B"]).toContain((await billing.paymentInstruction()).value)
      const rows = await billing.listBillingSettings({ key: "payment_instruction" })
      expect(rows).toHaveLength(1)

      const search = await call.get("/admin/cp/payments?view=overdue&q=atolye", readonly)
      expect(search.data).toMatchObject({ search_truncated: false })
    })
  },
})
