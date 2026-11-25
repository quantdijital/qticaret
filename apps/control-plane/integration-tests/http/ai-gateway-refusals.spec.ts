import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { setDailyCap } from "../../src/lib/ai-credits/staff"
import { ensureSigningKey } from "../helpers/fleet"
import { walletOf } from "../helpers/ai-credits"
import {
  callAs,
  callQuery,
  chatBody,
  jsonOf,
  sendCall,
  signedCall,
  startFakeProvider,
} from "../helpers/ai-provider"
import type { CallReply, FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import type { AiShop } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

/**
 * adr/0085 §2, "Güvenlik": what the gateway refuses before any provider is
 * asked, and that a refusal costs nothing. The shop is the signature's
 * alone (kabul 7); the signature covers the call's query and its bytes,
 * so a value changed after signing is a forgery; the task, the capability
 * and the routed service must agree (kabul 8); a shop without the flag or
 * not active is served nothing and gets no wallet (kabul 9); the day's
 * cap and the AI bucket stop a call before the provider.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let provider: FakeProvider

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
      provider = await startFakeProvider()
    })
    afterAll(async () => {
      await provider.close()
    })
    beforeEach(async () => {
      provider.seen.length = 0
      provider.answer({})
      await routeAll(getContainer())
    })

    const shop = (options: Parameters<typeof aiShop>[3] = {}) =>
      aiShop(http, getContainer(), owner, { monthly: 100, ...options })
    const refusalOf = (reply: CallReply) => [
      reply.status,
      reply.headers["x-qt-ai-refusal"] ?? (jsonOf(reply)["message"] as string | undefined),
    ]
    /** Nothing taken: no wallet yet, or the month's grant whole and nothing spent today. */
    const untouched = async (who: AiShop) => {
      const wallet = await walletOf(getContainer(), who.id)
      expect([wallet?.plan_balance ?? 100, wallet?.spent_today ?? 0]).toEqual([100, 0])
    }

    it("serves the signature's shop alone, whatever names another (kabul 7)", async () => {
      const a = await shop()
      const b = await shop()
      // A's key over B's id: a forgery
      const forged = await callAs(http, a, chatBody(), { tenantId: b.id })
      expect(refusalOf(forged)).toEqual([401, "signature.invalid"])
      // B's id in a header added after signing, or in the body: A is charged, never B
      const named = await callAs(http, a, chatBody({ tenant_id: b.id }), {
        extra: { "x-tenant-id": b.id, "x-qt-ai-tenant": b.id },
      })
      expect(named.status).toBe(200)
      expect((await walletOf(getContainer(), a.id))?.plan_balance).toBe(99)
      await untouched(b)
      expect(provider.seen).toHaveLength(1)
    })

    it("refuses a query or bytes changed after signing, and a replay", async () => {
      const who = await shop()
      const operation = randomUUID()
      const query = callQuery({ task: "seo_title", operation })
      // Signed as a 1-credit title, sent as an 8-credit post: refused, no provider, no credit
      const swapped = await callAs(http, who, chatBody(), {
        query,
        sentQuery: query.replace("task=seo_title", "task=post_draft"),
      })
      expect(refusalOf(swapped)).toEqual([401, "signature.invalid"])
      // One more value than signed (the gateway would refuse it anyway, but the signature first)
      const added = await callAs(http, who, chatBody(), { query, sentQuery: `${query}&x=1` })
      expect(refusalOf(added)).toEqual([401, "signature.invalid"])
      const unsigned = await callAs(http, who, chatBody(), { unsigned: true })
      expect(refusalOf(unsigned)).toEqual([401, "signature.malformed"])
      const changed = await callAs(http, who, chatBody(), {
        sentBody: chatBody({ max_tokens: 361 }),
      })
      expect(refusalOf(changed)).toEqual([401, "signature.invalid"])
      expect(provider.seen).toEqual([])
      await untouched(who)

      const call = signedCall(who, chatBody())
      expect((await sendCall(http, call)).status).toBe(200)
      expect(refusalOf(await sendCall(http, call))).toEqual([401, "signature.replayed"])
      expect(provider.seen).toHaveLength(1)
      expect((await walletOf(getContainer(), who.id))?.plan_balance).toBe(99)
    })

    it("holds the task, the capability and the routed service together (kabul 8)", async () => {
      const who = await shop()
      // A title never runs as vision
      const vision = await callAs(http, who, chatBody(), {
        task: "seo_title",
        capability: "vision",
      })
      expect(refusalOf(vision)).toEqual([422, "task_mismatch"])
      // The query names a service the routing does not: compared, never chosen
      const other = await callAs(http, who, chatBody(), { service: "deepseek" })
      expect(refusalOf(other)).toEqual([503, "unavailable"])
      expect(provider.seen).toEqual([])
      await untouched(who)

      // One operation, one capability: text first, then vision under the same id
      const operation = randomUUID()
      const first = await callAs(http, who, chatBody(), {
        task: "product_attributes",
        operation,
      })
      expect(first.status).toBe(200)
      const switched = await callAs(http, who, chatBody(), {
        task: "product_attributes",
        capability: "vision",
        operation,
      })
      expect(refusalOf(switched)).toEqual([422, "task_mismatch"])
      expect(provider.seen).toHaveLength(1)
      expect((await walletOf(getContainer(), who.id))?.plan_balance).toBe(99)
    })

    it("serves nothing without the flag or to a shop not active (kabul 9)", async () => {
      const off = await shop({ flag: false })
      expect(refusalOf(await callAs(http, off, chatBody()))).toEqual([503, "unavailable"])
      expect(await walletOf(getContainer(), off.id)).toBeUndefined()
      const suspended = await shop({ status: "suspended" })
      expect(refusalOf(await callAs(http, suspended, chatBody()))).toEqual([503, "unavailable"])
      expect(await walletOf(getContainer(), suspended.id)).toBeUndefined()
      expect(provider.seen).toEqual([])
    })

    it("stops at the day's cap before the provider", async () => {
      const who = await shop()
      await setDailyCap(getContainer(), { tenantId: who.id, cap: 1, now: new Date() })
      expect((await callAs(http, who, chatBody())).status).toBe(200)
      const over = await callAs(http, who, chatBody())
      expect(refusalOf(over)).toEqual([429, "daily_cap"])
      expect(provider.seen).toHaveLength(1)
      expect((await walletOf(getContainer(), who.id))?.plan_balance).toBe(99)
    })

    it("refuses a task not sold on credits and a broken query, free", async () => {
      const who = await shop()
      expect(refusalOf(await callAs(http, who, chatBody(), { task: "search_intent" }))).toEqual([
        404,
        "not_offered",
      ])
      const full = callQuery()
      for (const query of [
        full.replace(/&service=[^&]+/, ""),
        `${full}&task=post_draft`,
        `${full}&model=fake-big`,
        full.replace("task=seo_title", "task=SEO%20Title"),
        "",
      ]) {
        expect(refusalOf(await callAs(http, who, chatBody(), { query }))).toEqual([
          400,
          "body_refused",
        ])
      }
      expect(provider.seen).toEqual([])
      await untouched(who)
    })

    it("counts calls in the shop's AI bucket: the 61st waits", async () => {
      const who = await shop()
      // The cheapest refusal (a task not on credits) still counts
      for (let i = 0; i < 60; i += 1) {
        expect((await callAs(http, who, chatBody(), { task: "search_intent" })).status).toBe(404)
      }
      const over = await callAs(http, who, chatBody())
      expect(over.status).toBe(429)
      expect(over.headers["retry-after"]).toBeDefined()
      expect(provider.seen).toEqual([])
      await untouched(who)
    })
  },
})
