import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { parsePublicKeys, verifyDocument } from "@qticaret/server-kit"
import {
  BILLING_HISTORY_PURPOSE,
  billingHistoryBinding,
  billingHistoryResponseSchema,
} from "@qticaret/types/control-plane"
import { addDays } from "../../src/lib/billing/days"
import { publishedKeys } from "../../src/lib/vault/signing"
import { at, billingOf, billingShop, chargesOf, day, mailbox, runAt } from "../helpers/billing"
import { ensureSigningKey, fleetOf, shopKey, shopReceiver, signedGet } from "../helpers/fleet"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

const HISTORY = "/tenant-api/v1/billing"

/**
 * adr/0061 Ek C20: a shop's subscription as its panel shows it. The
 * signed plan document carries the terms (period, price, trial) as
 * optional fields the shop's own checks accept; the payment history is a
 * signed read of the shop's own charges only, bound to the request's
 * nonce, with nothing staff wrote and no voided charge. Another shop's id,
 * a query asking for one, or a staff credential gets nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let finance: Member
    let operator: Member

    beforeAll(async () => {
      await makeMember(http, getContainer(), "owner")
      finance = await makeMember(http, getContainer(), "finance")
      operator = await makeMember(http, getContainer(), "operator")
      await ensureSigningKey(getContainer())
    })

    const get = (headers: Record<string, string>, path = HISTORY) =>
      http.get(path, { ...anyStatus, headers })

    const keys = async () =>
      parsePublicKeys((await publishedKeys(getContainer())).env_value, "CONTROL_PLANE_PUBLIC_KEYS")

    /** A shop billed for three periods: the first paid, the second voided, the third open. */
    async function billedShop() {
      const shop = await billingShop(http, getContainer(), { finance, operator })
      const box = mailbox()
      for (const offset of [-50, -20, 0]) {
        await runAt(getContainer(), at(day(offset), 10), box)
      }
      const [first, second] = await chargesOf(getContainer(), shop.id)
      await billingOf(getContainer()).updateCharges([
        {
          id: first?.id ?? "",
          status: "paid",
          paid_on: addDays(first?.due_on ?? day(-50), 1),
          method: "bank_transfer",
          reference: "EFT 2611-0042 Selin Aydın",
          settle_reason: null,
        },
        { id: second?.id ?? "", status: "void", settle_reason: "yanlış dönem" },
      ])
      return { ...shop, signer: await shopKey(getContainer(), shop.id) }
    }

    it("hands a shop its own charges, latest first, bound to its nonce, nothing staff wrote", async () => {
      const shop = await billedShop()
      const all = await chargesOf(getContainer(), shop.id)
      const headers = signedGet(HISTORY, shop.id, shop.signer)

      const answer = await get(headers)

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      const { history, binding } = billingHistoryResponseSchema.parse(answer.data)
      expect(history.tenant_id).toBe(shop.id)
      const open = all.filter((charge) => charge.status === "open")
      const paid = all.find((charge) => charge.status === "paid")
      // The voided charge is left out; the latest period first
      expect(history.records.map((record) => record.id)).toEqual([
        ...open.map((charge) => charge.id).reverse(),
        paid?.id,
      ])
      expect(history.records.at(-1)).toMatchObject({
        status: "paid",
        paid_on: paid?.paid_on,
        amount: 149_000,
        currency: "TRY",
        invoice_url: null,
      })
      const text = JSON.stringify(answer.data)
      for (const kept of ["EFT", "Selin", "yanlış", "bank_transfer", "list_amount", "settled"]) {
        expect(text).not.toContain(kept)
      }
      // Bound to this request's nonce, and to no other
      const known = (await keys()).get(binding.kid)
      const nonce = headers["x-qt-nonce"] ?? ""
      expect(
        verifyDocument(
          BILLING_HISTORY_PURPOSE,
          billingHistoryBinding(nonce, history),
          binding,
          () => known
        )
      ).toMatchObject({ ok: true })
      expect(
        verifyDocument(
          BILLING_HISTORY_PURPOSE,
          billingHistoryBinding(`${nonce}x`, history),
          binding,
          () => known
        )
      ).toEqual({ ok: false, code: "signature.invalid" })
    })

    it("never answers with another shop's records", async () => {
      const first = await billedShop()
      const second = await billedShop()
      const ofFirst = (await chargesOf(getContainer(), first.id)).map((charge) => charge.id)

      // The second shop's own history holds none of the first's
      const own = billingHistoryResponseSchema.parse(
        (await get(signedGet(HISTORY, second.id, second.signer))).data
      )
      expect(own.history.tenant_id).toBe(second.id)
      expect(own.history.records.some((record) => ofFirst.includes(record.id))).toBe(false)

      // The second's key claiming the first's id: refused, like any unknown key
      const claimed = await get(signedGet(HISTORY, first.id, second.signer))
      expect([claimed.status, claimed.data["message"]]).toEqual([401, "signature.invalid"])

      // Asking for the first by query: the route reads no parameter, the signer's own comes back
      const asked = `${HISTORY}?tenant_id=${first.id}`
      const queried = await get(signedGet(asked, second.id, second.signer), asked)
      expect(queried.status).toBe(200)
      const answer = billingHistoryResponseSchema.parse(queried.data)
      expect(answer.history.tenant_id).toBe(second.id)
      expect(answer.history.records.some((record) => ofFirst.includes(record.id))).toBe(false)
    })

    it("opens for no staff credential, no unsigned call and no replay", async () => {
      const shop = await billedShop()
      const owner = await makeMember(http, getContainer(), "owner")

      expect((await get(owner.headers)).status).toBe(401)
      expect((await get({})).status).toBe(401)
      const headers = signedGet(HISTORY, shop.id, shop.signer)
      expect((await get(headers)).status).toBe(200)
      const replay = await get(headers)
      expect([replay.status, replay.data["message"]]).toEqual([401, "signature.replayed"])
      const post = await http.post(HISTORY, {}, { ...anyStatus, headers })
      expect(post.status).toBe(404)
    })

    it("answers an empty history for a shop with nothing charged yet", async () => {
      const shop = await billingShop(http, getContainer(), { finance, operator })
      const signer = await shopKey(getContainer(), shop.id)

      const answer = billingHistoryResponseSchema.parse(
        (await get(signedGet(HISTORY, shop.id, signer))).data
      )

      expect(answer.history).toEqual({ tenant_id: shop.id, records: [] })
    })

    it("puts the period, the price and the trial in the plan document, which the shop accepts", async () => {
      const shop = await billingShop(
        http,
        getContainer(),
        { finance, operator },
        { price: 99_000, trial_days: 14 }
      )
      await runAt(getContainer(), at(day(0), 10), mailbox())

      const latest = await fleetOf(getContainer()).latestPlanDocument(shop.id)

      expect(latest?.document.billing).toMatchObject({
        status: "trialing",
        period: "monthly",
        price: 99_000,
        trial_started_on: day(0),
        trial_ends_on: day(14),
      })
      const signed = {
        document: latest?.document,
        kid: latest?.kid,
        signature: latest?.signature,
      }
      const { checkPlanDocument } = shopReceiver()
      expect(checkPlanDocument(signed, { publicKeys: await keys(), tenantId: shop.id })).toEqual({
        ok: true,
        signed,
      })
    })
  },
})
