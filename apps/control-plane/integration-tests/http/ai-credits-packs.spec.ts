import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  aiCreditSettingsOf,
  saveAiCreditSettings,
} from "../../src/lib/ai-credits/platform-settings"
import { ensureSigningKey } from "../helpers/fleet"
import { pgOf, walletOf } from "../helpers/ai-credits"
import { aiShop, getAs, orderAs, pack, routeAll } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

/**
 * PR #371 D3 and its missing test: a pack's id names its terms. Credits
 * or an amount changed make a new pack (a new id), so a shop asking with
 * the id it was shown is refused rather than priced anew; a request made
 * keeps its own copy of the pack, and "paid" adds the copy's credits
 * whatever the pack became or if it is gone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
    })

    const packsNow = async () => (await aiCreditSettingsOf(getContainer())).packs
    const ordersOf = async (tenantId: string) =>
      (
        await pgOf(getContainer()).raw(
          "SELECT id, pack_id, pack_name, credits, amount, status FROM ai_credit_order WHERE tenant_id = ?",
          [tenantId]
        )
      ).rows
    const refusal = (answer: { status: number; data: { message?: string } }) => [
      answer.status,
      answer.data.message,
    ]

    it("refuses the old id of a repriced pack instead of charging the new price", async () => {
      await routeAll(getContainer(), { packs: [pack("Küçük", 500, 14_900)] })
      const [shown] = await packsNow()
      const shop = await aiShop(http, getContainer(), owner)
      expect(await getAs(http, shop)).toMatchObject({
        data: { packs: [{ id: shown?.id, credits: 500, amount: 14_900 }] },
      })

      // The owner raises the price of the pack the shop was shown
      await saveAiCreditSettings(
        getContainer(),
        { packs: [{ ...pack("Küçük", 500, 19_900), id: shown?.id }] },
        "test"
      )
      const [repriced] = await packsNow()
      expect(repriced?.id).not.toBe(shown?.id)
      expect(repriced).toMatchObject({ credits: 500, amount: 19_900 })
      expect(
        refusal(await orderAs(http, shop, { pack_id: shown?.id, requested_by: "usr_1" }))
      ).toEqual([404, "ai_credits.pack_unknown"])
      expect(await ordersOf(shop.id)).toEqual([])

      // A new name or taking it off sale keeps the id; the terms are what it buys
      await saveAiCreditSettings(
        getContainer(),
        { packs: [{ ...pack("Başlangıç", 500, 19_900, false), id: repriced?.id }] },
        "test"
      )
      expect((await packsNow()).map((each) => each.id)).toEqual([repriced?.id])
    })

    it("keeps a request's own copy when its pack changes or goes, and pays that", async () => {
      await routeAll(getContainer(), { packs: [pack("Orta", 1_000, 24_900)] })
      const [offered] = await packsNow()
      const shop = await aiShop(http, getContainer(), owner)
      const made = await orderAs(http, shop, { pack_id: offered?.id, requested_by: "usr_1" })
      expect(made.status).toBe(201)
      const [before] = await ordersOf(shop.id)

      await saveAiCreditSettings(
        getContainer(),
        { packs: [{ ...pack("Orta artı", 2_000, 9_900), id: offered?.id }] },
        "test"
      )
      expect(await ordersOf(shop.id)).toEqual([before])
      await saveAiCreditSettings(getContainer(), { packs: [] }, "test")
      expect(await ordersOf(shop.id)).toEqual([before])
      expect(before).toMatchObject({
        pack_id: offered?.id,
        pack_name: "Orta",
        credits: 1_000,
        amount: 24_900,
        status: "pending",
      })

      const paid = await call.post(
        `/admin/cp/ai/orders/${String(before?.["id"])}/paid`,
        { method: "bank_transfer" },
        owner,
        await proved(http, owner)
      )
      expect(paid.data).toMatchObject({ applied: true, order: { status: "paid" } })
      expect((await walletOf(getContainer(), shop.id))?.purchased_balance).toBe(1_000)
    })
  },
})
