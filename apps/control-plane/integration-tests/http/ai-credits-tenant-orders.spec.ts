import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { aiCreditOrderResponseSchema } from "@qticaret/types/control-plane"
import { aiCreditSettingsOf } from "../../src/lib/ai-credits/platform-settings"
import { pgOf } from "../helpers/ai-credits"
import { ensureSigningKey, signedGet } from "../helpers/fleet"
import { CREDITS, aiShop, getAs, orderAs, pack, routeAll, unrouteAll } from "../helpers/ai-shops"
import type { AiShop } from "../helpers/ai-shops"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

const PLAN = "/tenant-api/v1/plan"

/**
 * adr/0085 K11, §2: `POST /tenant-api/v1/ai/orders`, a shop's top-up
 * request. Only an active pack's id and the asking user's opaque id are
 * taken (credits, an amount or a shop sent are refused); the credits and
 * price are the platform's pack's; one pending request at a time; none
 * while credits are unavailable or the shop is not active. Both AI routes
 * count in their own per-shop bucket (`tenant_api_ai`, 60 a minute),
 * apart from the signer's (30) the other tenant API routes share.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
    })

    const shop = (options: Parameters<typeof aiShop>[3] = {}) =>
      aiShop(http, getContainer(), owner, options)
    const ordersOf = async (tenantId: string) =>
      (
        await pgOf(getContainer()).raw(
          "SELECT pack_id, credits, amount, status, requested_by FROM ai_credit_order WHERE tenant_id = ?",
          [tenantId]
        )
      ).rows
    const refusal = (answer: { status: number; data: { message?: string } }) => [
      answer.status,
      answer.data.message,
    ]

    /** The packs saved: one active, one withdrawn; their ids as the platform gave them. */
    async function packs(): Promise<{ small: string; big: string }> {
      await routeAll(getContainer(), {
        packs: [pack("Küçük", 500, 14_900), pack("Büyük", 5_000, 79_900, false)],
      })
      const [small, big] = (await aiCreditSettingsOf(getContainer())).packs
      return { small: small?.id ?? "", big: big?.id ?? "" }
    }

    it("takes an active pack's id and prices it from the platform's pack", async () => {
      const { small, big } = await packs()
      const a = await shop()
      const invalid = { status: 400, message: "errors.invalid_request" }
      const unknown = [404, "ai_credits.pack_unknown"]
      for (const body of [
        { pack_id: small, requested_by: "usr_1", credits: 1_000_000 },
        { pack_id: small, requested_by: "usr_1", amount: 1 },
        { pack_id: small, requested_by: "usr_1", tenant_id: "ten_other" },
        { pack_id: small, requested_by: "owner@example.com" },
        { pack_id: small },
        { requested_by: "usr_1" },
      ]) {
        const answer = await orderAs(http, a, body)
        expect({ status: answer.status, message: answer.data.message }).toEqual(invalid)
      }
      // A pack never made and a withdrawn one: the same refusal, nothing more said
      expect(
        refusal(await orderAs(http, a, { pack_id: "pack_0000000000000000", requested_by: "u" }))
      ).toEqual(unknown)
      expect(refusal(await orderAs(http, a, { pack_id: big, requested_by: "u" }))).toEqual(unknown)
      expect(await ordersOf(a.id)).toEqual([])

      const made = await orderAs(http, a, { pack_id: small, requested_by: "usr_1" })
      expect(made.status).toBe(201)
      expect(made.headers["cache-control"]).toBe("no-store")
      expect(aiCreditOrderResponseSchema.parse(made.data)).toMatchObject({
        order: {
          pack: { id: small, name: "Küçük", credits: 500, amount: 14_900, currency: "TRY" },
          status: "pending",
        },
      })
      expect(await ordersOf(a.id)).toEqual([
        { pack_id: small, credits: 500, amount: 14_900, status: "pending", requested_by: "usr_1" },
      ])
      // One pending request at a time
      expect(refusal(await orderAs(http, a, { pack_id: small, requested_by: "usr_2" }))).toEqual([
        409,
        "cp.ai_credit_order_pending",
      ])
      expect(await getAs(http, a)).toMatchObject({
        data: { pending_order: { pack: { id: small }, status: "pending" } },
      })
    })

    it("refuses a request while credits are unavailable or the shop is not active", async () => {
      const { small } = await packs()
      const unavailable = [400, "ai_credits.unavailable"]
      const held = [
        await shop({ flag: false }),
        await shop({ status: "suspended" }),
        await shop({ status: "restricted" }),
      ]
      for (const who of held) {
        expect(refusal(await orderAs(http, who, { pack_id: small, requested_by: "u" }))).toEqual(
          unavailable
        )
        expect(await ordersOf(who.id)).toEqual([])
      }
      const open = await shop()
      await unrouteAll(getContainer())
      expect(refusal(await orderAs(http, open, { pack_id: small, requested_by: "u" }))).toEqual(
        unavailable
      )
      expect(await ordersOf(open.id)).toEqual([])
    })

    it("counts the AI routes in their own bucket, apart from the signer's", async () => {
      await routeAll(getContainer())
      const status = (who: AiShop) => getAs(http, who, CREDITS)
      const plan = (who: AiShop) =>
        http.get(PLAN, { ...anyStatus, headers: signedGet(PLAN, who.id, who.signer) })

      // A: the signer's 30 spent on the plan route; the AI route still answers
      const a = await shop()
      for (let i = 0; i < 30; i += 1) {
        expect((await plan(a)).status).not.toBe(429)
      }
      expect((await plan(a)).status).toBe(429)
      expect((await status(a)).status).toBe(200)

      // B: the AI bucket's 60 spent; the 61st waits, the plan route does not
      const b = await shop()
      for (let i = 0; i < 60; i += 1) {
        expect((await status(b)).status).toBe(200)
      }
      const over = await status(b)
      expect(over.status).toBe(429)
      expect(over.headers["retry-after"]).toBeDefined()
      expect((await orderAs(http, b, { pack_id: "pack_x", requested_by: "u" })).status).toBe(429)
      expect((await plan(b)).status).not.toBe(429)
    })
  },
})
