import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  aiCreditSettingsOf,
  saveAiCreditSettings,
} from "../../src/lib/ai-credits/platform-settings"
import { plansIn, tenantsIn } from "../../src/workflows/modules"
import { adjustKey, pgOf, walletOf } from "../helpers/ai-credits"
import { ensureSigningKey, shopKey, signedGet, signedPost } from "../helpers/fleet"
import { CREDITS, ORDERS, aiShop, getAs, orderAs, pack, routeAll } from "../helpers/ai-shops"
import type { AiShop } from "../helpers/ai-shops"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

/**
 * PR #371's missing tests on the shop's side: a top-up request's
 * signature over its exact bytes (changed, replayed, too large, not
 * JSON); the shops credits are never offered to (closing, closed, no
 * package, an exception past its day); a flood signed wrongly in another
 * shop's name spends nothing of that shop's AI bucket (D4).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let small = ""

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
      await routeAll(getContainer(), { packs: [pack("Küçük", 500, 14_900)] })
      small = (await aiCreditSettingsOf(getContainer())).packs[0]?.id ?? ""
    })

    const shop = (options: Parameters<typeof aiShop>[3] = {}) =>
      aiShop(http, getContainer(), owner, options)
    const ordersOf = async (tenantId: string) =>
      (
        await pgOf(getContainer()).raw(
          "SELECT pack_id, requested_by FROM ai_credit_order WHERE tenant_id = ?",
          [tenantId]
        )
      ).rows
    const sendRaw = (headers: Record<string, string>, raw: string) =>
      http.post(ORDERS, raw, { ...anyStatus, headers })

    it("holds a request to the bytes signed: changed, replayed, too large, not JSON", async () => {
      const a = await shop()
      const signedBody = JSON.stringify({ pack_id: small, requested_by: "usr_1" })
      const changed = JSON.stringify({ pack_id: small, requested_by: "usr_2" })
      expect((await sendRaw(signedPost(ORDERS, a.id, a.signer, signedBody), changed)).status).toBe(
        401
      )
      expect(await ordersOf(a.id)).toEqual([])

      // The same signed request twice: one request made, the replay refused
      const headers = signedPost(ORDERS, a.id, a.signer, signedBody)
      const first = await sendRaw(headers, signedBody)
      const replay = await sendRaw(headers, signedBody)
      expect([first.status, replay.status]).toEqual([201, 401])
      expect(await ordersOf(a.id)).toEqual([{ pack_id: small, requested_by: "usr_1" }])

      // Over 1 KB, signed as it is: refused by its size
      const b = await shop()
      const large = JSON.stringify({ pack_id: small, requested_by: "u".repeat(1_100) })
      expect((await sendRaw(signedPost(ORDERS, b.id, b.signer, large), large)).status).toBe(413)
      // Not JSON, signed as it is: never read as a request
      const plain = `pack_id=${small}&requested_by=usr_1`
      const notJson = await sendRaw(
        { ...signedPost(ORDERS, b.id, b.signer, plain), "content-type": "text/plain" },
        plain
      )
      expect(notJson.status).toBe(400)
      expect(await ordersOf(b.id)).toEqual([])
    })

    it("offers nothing to a closing, closed or package-less shop, or past an exception's day", async () => {
      const closing = await shop({ status: "closing" })
      const closed = await shop({ status: "closing" })
      await tenantsIn(getContainer()).changeStatus(closed.id, "closed", {
        reason_code: "test",
        actor: "system",
      })
      // A shop without a package: its plan says nothing of the flag
      const tenant = await makeTenant(http, owner)
      await tenantsIn(getContainer()).changeStatus(tenant.id, "active", {
        reason_code: "provisioned",
        actor: "system",
      })
      const bare: AiShop = { id: tenant.id, signer: await shopKey(getContainer(), tenant.id) }
      // The flag off in its package, on by an exception that ran out yesterday
      const lapsed = await shop({ flag: false })
      await plansIn(getContainer()).setFeatureOverride(lapsed.id, "ai.platform_credits", {
        enabled: true,
        reason: "test",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        created_by: null,
      })
      for (const [name, who] of Object.entries({ closing, closed, bare, lapsed })) {
        const status = await getAs(http, who)
        const order = await orderAs(http, who, { pack_id: small, requested_by: "u" })
        expect([name, status.status, status.data, order.status, order.data.message]).toEqual([
          name,
          200,
          { available: false },
          400,
          "ai_credits.unavailable",
        ])
        expect(await ordersOf(who.id)).toEqual([])
      }
      // The same exception still in force opens it
      const current = await shop({ flag: false })
      await plansIn(getContainer()).setFeatureOverride(current.id, "ai.platform_credits", {
        enabled: true,
        reason: "test",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_by: null,
      })
      expect((await getAs(http, current)).data).toMatchObject({ available: true })
    })

    it("spends nothing of a shop's AI bucket on a flood signed wrongly in its name", async () => {
      const victim = await shop()
      const attacker = await shop()
      // The victim's id, the attacker's key: the signature fails, every time
      for (let i = 0; i < 70; i += 1) {
        const answer = await http.get(CREDITS, {
          ...anyStatus,
          headers: signedGet(CREDITS, victim.id, attacker.signer),
        })
        expect(answer.status).toBe(401)
      }
      for (let i = 0; i < 60; i += 1) {
        expect((await getAs(http, victim)).status).toBe(200)
      }
      expect((await getAs(http, victim)).status).toBe(429)
    })

    it("keeps one whole save of two at once, never a mix", async () => {
      const one = { daily_cap: 111, purchased_lifetime_months: 2, packs: [pack("Bir", 100, 1_000)] }
      const two = { daily_cap: 222, purchased_lifetime_months: 4, packs: [pack("İki", 200, 2_000)] }
      const saves = await Promise.allSettled([
        saveAiCreditSettings(getContainer(), one, "user_one"),
        saveAiCreditSettings(getContainer(), two, "user_two"),
      ])
      expect(saves.map((each) => each.status)).toEqual(["fulfilled", "fulfilled"])
      const kept = await aiCreditSettingsOf(getContainer())
      const winner = kept.updatedBy === "user_one" ? one : two
      expect(kept).toMatchObject({
        dailyCap: winner.daily_cap,
        lifetimeMonths: winner.purchased_lifetime_months,
        packs: [expect.objectContaining({ name: winner.packs[0]?.name })],
      })
      expect(kept.packs).toHaveLength(1)
    })

    it("refuses a correction's key reused for another shop or amount (409)", async () => {
      const [a, b] = [await makeTenant(http, owner), await makeTenant(http, owner)]
      const adjust = async (tenantId: string, body: Record<string, unknown>) =>
        client(http).post(
          `/admin/cp/tenants/${tenantId}/ai-credits/adjust`,
          body,
          owner,
          await proved(http, owner)
        )
      const body = { amount: 40, bucket: "purchased", note: "Düzeltme", key: adjustKey() }
      expect((await adjust(a.id, body)).data).toMatchObject({ applied: true, balance: 40 })
      const conflict = [409, "cp.ai_credit_grant_ref_conflict"]
      for (const [tenantId, change] of [
        [b.id, {}],
        [a.id, { amount: 41 }],
        [a.id, { amount: -40 }],
      ] as const) {
        const answer = await adjust(tenantId, { ...body, ...change })
        expect([tenantId, answer.status, (answer.data as { message?: string }).message]).toEqual([
          tenantId,
          ...conflict,
        ])
      }
      expect((await walletOf(getContainer(), a.id))?.purchased_balance).toBe(40)
      expect(await walletOf(getContainer(), b.id)).toBeUndefined()
    })
  },
})
