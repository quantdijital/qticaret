import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  AI_CREDITS_STATUS_MAX_BYTES,
  AI_TASK_CREDITS,
  aiCreditsStatusSchema,
} from "@qticaret/types/control-plane"
import {
  aiCreditSettingsOf,
  saveAiCreditSettings,
} from "../../src/lib/ai-credits/platform-settings"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import { addMonths, istanbulMonth } from "../../src/lib/ai-credits/period"
import { deleteProviderKey, writeProviderKey } from "../../src/lib/ai-gateway/keys"
import { ensureSigningKey, signedGet } from "../helpers/fleet"
import { pgOf, setMonthlyGrant, walletOf } from "../helpers/ai-credits"
import { CREDITS, TEST_KEY, aiShop, getAs, orderAs, pack, routeAll } from "../helpers/ai-shops"
import type { AiShop } from "../helpers/ai-shops"
import { anyStatus, makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

const UNAVAILABLE = { available: false }

/**
 * adr/0085 §2, kabul testi 7: `GET /tenant-api/v1/ai/credits`, a shop's
 * own view of the platform's credits over its signed API. Available only
 * with the flag on, a capability routed and its key held, and only to an
 * `active` shop; unavailable, it says just that and opens no wallet.
 * Available, it names services, never a model or a key, holds to the
 * shared contract and stays under 16 KB. The shop is the signature's:
 * nothing in the request picks another.
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
    const statusOf = async (who: AiShop) => {
      const answer = await getAs(http, who)
      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      return answer.data
    }

    it("says only 'not available' until the flag, a routing and its key are all there", async () => {
      const off = await shop({ flag: false })
      const on = await shop()
      // All three present, the flag off: nothing but the word, no wallet opened
      await routeAll(getContainer())
      expect(await statusOf(off)).toEqual(UNAVAILABLE)
      expect(await walletOf(getContainer(), off.id)).toBeUndefined()

      // The flag on, routed, no key
      await deleteProviderKey(getContainer(), "fake", "test")
      await routeAll(getContainer(), { key: false })
      expect(await statusOf(on)).toEqual(UNAVAILABLE)
      // The flag on, a key, nothing routed
      await writeProviderKey(getContainer(), "fake", TEST_KEY)
      await saveAiCreditSettings(getContainer(), { routing: {} }, "test")
      expect(await statusOf(on)).toEqual(UNAVAILABLE)
      expect(await walletOf(getContainer(), on.id)).toBeUndefined()

      // All three: available, and only now a wallet
      await routeAll(getContainer())
      expect(await statusOf(on)).toMatchObject({ available: true })
      expect(await walletOf(getContainer(), on.id)).toMatchObject({ plan_balance: 100 })
      // The key destroyed takes the routing with it: unavailable again
      await deleteProviderKey(getContainer(), "fake", "test")
      expect(await statusOf(on)).toEqual(UNAVAILABLE)
    })

    it("answers a suspended or restricted shop 'not available', whatever its flag", async () => {
      await routeAll(getContainer())
      for (const status of ["suspended", "restricted"] as const) {
        const held = await shop({ status })
        expect(await statusOf(held)).toEqual(UNAVAILABLE)
        expect(await walletOf(getContainer(), held.id)).toBeUndefined()
      }
    })

    it("answers its largest status by the contract, under 16 KB, with no model and no key", async () => {
      const long = (index: number) => `${String(index)} ${"Ğ".repeat(97)}`
      await routeAll(getContainer(), {
        packs: Array.from({ length: 10 }, (_, index) =>
          pack(long(index), 1_000_000 - index, 99_999_999 - index)
        ),
      })
      const who = await shop({ monthly: 250 })
      const [first] = (await aiCreditSettingsOf(getContainer())).packs
      expect(
        (await orderAs(http, who, { pack_id: first?.id, requested_by: "usr_01" })).status
      ).toBe(201)

      const answer = await getAs(http, who)
      const status = aiCreditsStatusSchema.parse(answer.data)
      expect(status).toMatchObject({
        available: true,
        balance: { plan: { remaining: 250 }, purchased: { remaining: 0, expires_on: null } },
        daily: { cap: 300, remaining: 300 },
        services: { text: "fake", vision: "fake", image_edit: "fake" },
        table: { ...AI_TASK_CREDITS },
        pending_order: { pack: { id: first?.id, credits: 1_000_000 }, status: "pending" },
      })
      expect(status.available && status.packs).toHaveLength(10)
      const text = JSON.stringify(answer.data)
      expect(Buffer.byteLength(text, "utf8")).toBeLessThan(AI_CREDITS_STATUS_MAX_BYTES)
      for (const secret of ["fake-text", "fake-vision", "fake-image", "fake-scene", "model"]) {
        expect(text).not.toContain(secret)
      }
      expect(text).not.toContain(TEST_KEY)
      expect(text).not.toContain(TEST_KEY.slice(9, 21))
    })

    it("shows the signing shop alone, whatever else the request names", async () => {
      await routeAll(getContainer(), { packs: [pack("Küçük", 500, 14_900)] })
      const a = await shop({ monthly: 100 })
      const b = await shop({ monthly: 7 })
      const [only] = (await aiCreditSettingsOf(getContainer())).packs
      expect((await orderAs(http, b, { pack_id: only?.id, requested_by: "usr_b" })).status).toBe(
        201
      )

      const mine = await statusOf(a)
      expect(mine).toMatchObject({ balance: { plan: { remaining: 100 } }, pending_order: null })
      // B's id in the query (signed with it), in a header of its own: A's answer still
      const query = `${CREDITS}?tenant_id=${b.id}`
      expect((await getAs(http, a, query)).data).toEqual(mine)
      expect((await getAs(http, a, CREDITS, { "x-tenant-id": b.id })).data).toEqual(mine)
      // A's key presented as B's: refused, as an unknown key is
      const posing = await http.get<{ message?: string }>(CREDITS, {
        ...anyStatus,
        headers: signedGet(CREDITS, b.id, a.signer),
      })
      expect([posing.status, posing.data.message]).toEqual([401, "signature.invalid"])
      expect(await statusOf(b)).toMatchObject({
        balance: { plan: { remaining: 7 } },
        pending_order: { status: "pending" },
      })
    })

    it("refuses an unsigned, a tampered, a stale and a replayed request", async () => {
      await routeAll(getContainer())
      const a = await shop()
      const get = (headers: Record<string, string>) =>
        http.get<{ message?: string }>(CREDITS, { ...anyStatus, headers })
      const good = signedGet(CREDITS, a.id, a.signer)
      const signature = good["x-qt-signature"] ?? ""
      const middle = Math.floor(signature.length / 2)
      const swapped = signature[middle] === "A" ? "B" : "A"
      const tampered = {
        ...good,
        "x-qt-signature": `${signature.slice(0, middle)}${swapped}${signature.slice(middle + 1)}`,
      }
      const old = signedGet(CREDITS, a.id, a.signer, { now: Date.now() - 6 * 60 * 1000 })

      const unsigned = await get({})
      expect([unsigned.status, unsigned.data.message]).toEqual([401, "signature.malformed"])
      expect((await get(tampered)).data.message).toBe("signature.invalid")
      expect((await get(old)).data.message).toBe("signature.stale")
      expect((await get(good)).status).toBe(200)
      const replay = await get(good)
      expect([replay.status, replay.data.message]).toEqual([401, "signature.replayed"])
      // None of the refused opened anything beyond the one good call's wallet
      const { rows } = await pgOf(getContainer()).raw(
        "SELECT count(*)::int AS n FROM ai_credit_wallet WHERE tenant_id = ?",
        [a.id]
      )
      expect(rows[0]).toEqual({ n: 1 })
    })

    it("turns the month on the status call: the package's grant, written anew", async () => {
      await routeAll(getContainer())
      const who = await shop({ monthly: 40 })
      const now = new Date()
      // The wallet opened last month, with last month's grant
      await balanceOf(getContainer(), who.id, addMonths(now, -1))
      expect(await walletOf(getContainer(), who.id)).toMatchObject({
        plan_period: istanbulMonth(addMonths(now, -1)),
        plan_balance: 40,
      })
      // The shop's own grant changed since: the new month is granted from the plan as it is now
      await setMonthlyGrant(getContainer(), who.id, 55)

      expect(await statusOf(who)).toMatchObject({ balance: { plan: { remaining: 55 } } })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({
        plan_period: istanbulMonth(now),
        plan_balance: 55,
      })
    })
  },
})
