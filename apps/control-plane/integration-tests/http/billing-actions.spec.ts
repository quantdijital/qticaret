import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { addDays } from "../../src/lib/billing/days"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { at, billingShop, chargesOf, day, eventually, mailbox, runAt } from "../helpers/billing"
import { ensureSigningKey, fleetOf } from "../helpers/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

const PAID = { method: "bank_transfer", reference: "EFT 2611-0042" }

/**
 * adr/0061 §3.5, §7, Ek C16: what staff do to the money. "Ödendi" and
 * "Bağışla" free a restricted shop at once and tell it in a new document;
 * an amount is corrected with a reason; a charge voided by the owner
 * alone; every change behind a step-up, finance's and the owner's, each in
 * the audit. A suspension ends by the payments; the grace has a shop's
 * own value; the payment instruction is the owner's and reaches every
 * shop signed.
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

    /** A shop whose first charge (due 20 days ago, 7 days' grace) restricted it today. */
    async function restrictedShop() {
      const shop = await billingShop(http, getContainer(), { finance, operator })
      const box = mailbox()
      await runAt(getContainer(), at(day(-20), 10), box)
      await runAt(getContainer(), at(day(0), 10), box)
      const [first, second] = await chargesOf(getContainer(), shop.id)
      return { ...shop, first: first?.id ?? "", second: second?.id ?? "" }
    }

    const act = async (
      member: Member,
      id: string,
      charge: string,
      action: string,
      body: unknown,
      proof = true
    ) =>
      call.post(
        `/admin/cp/tenants/${id}/charges/${charge}/${action}`,
        body,
        member,
        proof ? await proved(http, member) : member.headers
      )

    it("marks paid: the shop active at once, a new document, the audit row", async () => {
      const shop = await restrictedShop()
      expect(await statusOf(shop.id)).toBe("restricted")
      const before = (await fleetOf(getContainer()).latestPlanDocument(shop.id))?.serial ?? 0

      const unproved = await act(
        finance,
        shop.id,
        shop.first,
        "pay",
        { paid_on: day(0), ...PAID },
        false
      )
      const byOperator = await act(operator, shop.id, shop.first, "pay", {
        paid_on: day(0),
        ...PAID,
      })
      const byReader = await act(readonly, shop.id, shop.first, "pay", { paid_on: day(0), ...PAID })
      const future = await act(finance, shop.id, shop.first, "pay", { paid_on: day(1), ...PAID })
      const paid = await act(finance, shop.id, shop.first, "pay", { paid_on: day(-1), ...PAID })
      const again = await act(finance, shop.id, shop.first, "pay", { paid_on: day(0), ...PAID })

      expect(unproved.status).toBe(428)
      expect(byOperator.status).toBe(403)
      expect(byReader.status).toBe(403)
      expect(future.data).toMatchObject({ message: "cp.paid_on_future" })
      expect(paid.status).toBe(200)
      expect(paid.data).toMatchObject({
        charge: {
          status: "paid",
          paid_on: day(-1),
          method: "bank_transfer",
          reference: PAID.reference,
        },
        tenant: { status: "active" },
      })
      expect(again.status).toBe(409)
      expect(await statusOf(shop.id)).toBe("active")
      const [row] = await tenants().listTenantStatusChanges(
        { tenant_id: shop.id, to_status: "active", reason_code: "payment_settled" },
        { take: 1 }
      )
      expect(row?.actor).toBe(finance.userId)
      const document = await fleetOf(getContainer()).latestPlanDocument(shop.id)
      expect(document?.serial).toBeGreaterThan(before)
      expect(document?.document).toMatchObject({ status: "active", billing: { status: "active" } })
      // Our own invoicing is off: the invoice fields stay empty
      expect(paid.data).toMatchObject({ charge: { invoice_number: null, invoice_ettn: null } })
      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/charges/:charge_id/pay",
        resource_id: shop.id,
      })
      expect(audit.map((each) => each.outcome).sort()).toEqual([200, 400, 403, 403, 409, 428])
      expect(audit.find((each) => each.outcome === 200)?.changes).toMatchObject({
        charge: { id: shop.first },
        status: { from: "open", to: "paid" },
        method: "bank_transfer",
        tenant_status: { from: "restricted", to: "active" },
      })
      expect(JSON.stringify(audit)).not.toContain(PAID.reference)
    })

    it("waives with a reason, corrects an amount, voids by the owner alone", async () => {
      const shop = await restrictedShop()

      const waived = await act(finance, shop.id, shop.first, "waive", { reason: "İlk ay hediye" })
      const noReason = await act(finance, shop.id, shop.second, "waive", { reason: "" })
      const corrected = await act(finance, shop.id, shop.second, "amount", {
        amount: 120_000,
        reason: "Sözleşmedeki indirim",
      })
      const voidByFinance = await act(finance, shop.id, shop.second, "void", {
        reason: "Yinelenen kayıt",
      })
      const voided = await act(owner, shop.id, shop.second, "void", { reason: "Yinelenen kayıt" })

      expect(waived.status).toBe(200)
      expect(waived.data).toMatchObject({
        charge: { status: "waived" },
        tenant: { status: "active" },
      })
      expect(noReason.status).toBe(400)
      expect(corrected.data).toMatchObject({
        charge: { amount: 120_000, list_amount: 149_000, amount_reason: "Sözleşmedeki indirim" },
      })
      expect(voidByFinance.status).toBe(403)
      expect(voided.data).toMatchObject({ charge: { status: "void" } })
      const amountAudit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/charges/:charge_id/amount",
        resource_id: shop.id,
      })
      expect(amountAudit[0]?.changes).toMatchObject({ amount: { from: 149_000, to: 120_000 } })
      const detail = await call.get(`/admin/cp/tenants/${shop.id}/subscription`, readonly)
      expect(detail.status).toBe(200)
      expect(detail.data).toMatchObject({
        subscription: { tenant_id: shop.id, grace_days_effective: 7 },
        invoicing: "none",
      })
      const charges = (detail.data as { charges: { status: string; settled_by: string }[] }).charges
      expect(charges.map((each) => each.status).sort()).toEqual(["void", "waived"])
      const reminders = (detail.data as { reminders: Record<string, unknown>[] }).reminders
      expect(JSON.stringify(reminders)).not.toContain("@")
    })

    it("ends a suspension by the payments: restricted while overdue, active once paid", async () => {
      const shop = await restrictedShop()
      const resume = async (id: string) =>
        call.post(
          `/admin/cp/tenants/${id}/resume`,
          { reason: "Görüşme yapıldı" },
          owner,
          await proved(http, owner)
        )
      await call.post(
        `/admin/cp/tenants/${shop.id}/suspend`,
        { reason: "Ödeme takibi" },
        owner,
        await proved(http, owner)
      )
      expect((await resume(shop.id)).data).toMatchObject({ tenant: { status: "restricted" } })

      await call.post(
        `/admin/cp/tenants/${shop.id}/suspend`,
        { reason: "Ödeme takibi" },
        owner,
        await proved(http, owner)
      )
      // Paid while suspended: the shop stays suspended until staff end it
      await act(finance, shop.id, shop.first, "pay", { paid_on: day(0), ...PAID })
      expect(await statusOf(shop.id)).toBe("suspended")
      expect((await resume(shop.id)).data).toMatchObject({ tenant: { status: "active" } })
      expect((await latest(shop.id))?.status).toBe("active")
    })

    it("gives a shop its own grace days with a reason, and back to the package's", async () => {
      const shop = await restrictedShop()
      const path = `/admin/cp/tenants/${shop.id}/subscription`

      const byReader = await call.post(path, { grace_days: 30, reason: "Bayram" }, readonly)
      const noReason = await call.post(
        path,
        { grace_days: 30 },
        finance,
        await proved(http, finance)
      )
      const longer = await call.post(
        path,
        { grace_days: 30, reason: "Bayram tatili, sahibiyle görüşüldü" },
        finance,
        await proved(http, finance)
      )
      expect(byReader.status).toBe(403)
      expect(noReason.status).toBe(400)
      expect(longer.data).toMatchObject({
        subscription: { grace_days_override: 30, grace_days_effective: 30, status: "past_due" },
      })
      expect(await statusOf(shop.id)).toBe("active")
      expect((await latest(shop.id))?.billing).toMatchObject({
        status: "past_due",
        grace_ends_on: addDays(day(-20), 30),
      })

      const back = await call.post(path, { grace_days: null }, finance, await proved(http, finance))
      expect(back.data).toMatchObject({ subscription: { grace_days_override: null } })
      expect(await statusOf(shop.id)).toBe("restricted")
    })

    it("keeps the payment instruction the owner's, and signs it into every document", async () => {
      const shop = await restrictedShop()
      const text =
        "Alıcı: Quant Dijital Yazılım\r\nIBAN: TR12 0006 4000 0011 2345 6789 01\nAçıklama: mağaza adresiniz"

      const read = await call.get("/admin/cp/billing-settings", readonly)
      const byFinance = await call.post(
        "/admin/cp/billing-settings",
        { payment_instruction: text },
        finance,
        await proved(http, finance)
      )
      const unproved = await call.post(
        "/admin/cp/billing-settings",
        { payment_instruction: text },
        owner
      )
      const bidi = await call.post(
        "/admin/cp/billing-settings",
        { payment_instruction: "IBAN \u202eTR" },
        owner,
        await proved(http, owner)
      )
      const set = await call.post(
        "/admin/cp/billing-settings",
        { payment_instruction: text },
        owner,
        await proved(http, owner)
      )

      expect(read.data).toMatchObject({ payment_instruction: null })
      expect(byFinance.status).toBe(403)
      expect(unproved.status).toBe(428)
      expect(bidi.status).toBe(400)
      const stored = text.replace(/\r\n/g, "\n")
      // Review: the request answers at once (202); every shop's document follows in the background
      expect(set.status).toBe(202)
      expect(set.data).toMatchObject({ payment_instruction: stored, documents: "reissuing" })
      await eventually(async () => {
        expect((await latest(shop.id))?.billing).toMatchObject({ payment_instruction: stored })
      })
      const audit = await auditRows(getContainer(), { action: "POST /admin/cp/billing-settings" })
      expect(JSON.stringify(audit)).not.toContain("TR12")
      expect(audit.find((each) => each.outcome === 202)?.changes).toMatchObject({
        payment_instruction: { from: null, to: { length: stored.length } },
      })

      const cleared = await call.post(
        "/admin/cp/billing-settings",
        { payment_instruction: "  " },
        owner,
        await proved(http, owner)
      )
      expect(cleared.data).toMatchObject({ payment_instruction: null })
      await eventually(async () => {
        expect((await latest(shop.id))?.billing).toMatchObject({ payment_instruction: null })
      })
    })

    it("lists upcoming, overdue and paid payments with their totals, and the next payment", async () => {
      const late = await restrictedShop()
      await act(finance, late.id, late.second, "pay", { paid_on: day(0), ...PAID })

      const overdue = await call.get("/admin/cp/payments?view=overdue", readonly)
      const paid = await call.get("/admin/cp/payments?view=paid", readonly)
      const upcoming = await call.get(`/admin/cp/payments?view=upcoming&q=zzz-yok`, readonly)
      const bad = await call.get("/admin/cp/payments?view=late", readonly)

      expect(overdue.data).toMatchObject({
        count: 1,
        total: 149_000,
        counts: { overdue: 1, paid: 1 },
        payments: [
          {
            id: late.first,
            tenant: { id: late.id, status: "restricted" },
            standing: "overdue",
            due_on: day(-20),
          },
        ],
      })
      expect(paid.data).toMatchObject({ count: 1, payments: [{ id: late.second }] })
      const [settled] = (paid.data as { payments: { settled_by: string | null }[] }).payments
      expect(settled?.settled_by).toBeTruthy()
      expect(upcoming.data).toMatchObject({ count: 0, payments: [] })
      expect(bad.status).toBe(400)
      const list = await call.get("/admin/cp/tenants?limit=50", readonly)
      const row = (
        list.data as { tenants: { id: string; next_payment_on: string | null }[] }
      ).tenants.find((each) => each.id === late.id)
      expect(row?.next_payment_on).toBe(day(-20))
    })
  },
})
