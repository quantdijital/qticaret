import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ensureSigningKey } from "../helpers/fleet"
import { walletOf } from "../helpers/ai-credits"
import { callAs, chatAnswer, chatBody, jsonOf, startFakeProvider } from "../helpers/ai-provider"
import type { CallReply, FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import type { AiShop } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

/**
 * adr/0085 §2, "Güvenlik": the bodies the gateway refuses before any
 * provider is asked (a tool outside the assistant, more pictures than the
 * task takes, more than a text task's input, more than 6 MB), each free;
 * and kabul 10: the gateway keeps no content. What a shop sent and what
 * a provider answered are in no table, on the happy path, a refusal and
 * a provider's failure alike: the operation's row holds the meta alone.
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

    const shop = () => aiShop(http, getContainer(), owner, { monthly: 100 })
    const refusalOf = (reply: CallReply) => [
      reply.status,
      reply.headers["x-qt-ai-refusal"],
      jsonOf(reply)["qt_ai_gateway"],
    ]
    const refused = (status: number, code: string) => [status, code, { code }]
    const untouched = async (who: AiShop) => {
      const wallet = await walletOf(getContainer(), who.id)
      expect([wallet?.plan_balance ?? 100, wallet?.spent_today ?? 0]).toEqual([100, 0])
    }
    const PICTURE = `data:image/png;base64,${Buffer.from("not really a png").toString("base64")}`
    const visionBody = (pictures: number) =>
      JSON.stringify({
        model: "fake-vision",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Alt metin yaz." },
              ...Array.from({ length: pictures }, () => ({
                type: "image_url",
                image_url: { url: PICTURE },
              })),
            ],
          },
        ],
        max_tokens: 100,
      })
    const TOOLS = [{ type: "function", function: { name: "lookup", parameters: {} } }]

    it("takes a tool from the assistant alone; anywhere else it is refused, free", async () => {
      const who = await shop()
      const title = await callAs(http, who, chatBody({ tools: TOOLS }))
      expect(refusalOf(title)).toEqual(refused(400, "body_refused"))
      const choice = await callAs(http, who, chatBody({ tool_choice: "auto" }))
      expect(refusalOf(choice)).toEqual(refused(400, "body_refused"))
      expect(provider.seen).toEqual([])
      await untouched(who)

      const assistant = await callAs(http, who, chatBody({ tools: TOOLS }), { task: "assistant" })
      expect(assistant.status).toBe(200)
      expect(JSON.parse(provider.seen[0]?.body.toString("utf8") ?? "{}")).toHaveProperty("tools")
    })

    it("sends a body rebuilt from the allow-list: no costly field reaches the provider", async () => {
      const who = await shop()
      const costly = {
        reasoning_effort: "high",
        extra_body: { google: { thinking_config: { thinking_budget: 24_576 } } },
        service_tier: "priority",
        store: true,
        web_search_options: {},
        modalities: ["text", "audio"],
        n: 4,
        max_tokens: 99_999,
      }
      const reply = await callAs(http, who, chatBody(costly))
      expect(reply.status).toBe(200)
      const seen = JSON.parse(provider.seen[0]?.body.toString("utf8") ?? "{}") as object
      expect(Object.keys(seen).sort()).toEqual(["max_tokens", "messages", "model", "stream"])
      expect(seen).toMatchObject({ model: "fake-text", stream: false, max_tokens: 360 })
    })

    it("takes as many pictures as the task does: one for an alt text", async () => {
      const who = await shop()
      const two = await callAs(http, who, visionBody(2), {
        task: "image_alt_text",
        capability: "vision",
      })
      expect(refusalOf(two)).toEqual(refused(400, "body_refused"))
      // A picture in a text call is refused alike
      const inText = await callAs(http, who, visionBody(1), { task: "product_attributes" })
      expect(refusalOf(inText)).toEqual(refused(400, "body_refused"))
      expect(provider.seen).toEqual([])
      await untouched(who)
      const one = await callAs(http, who, visionBody(1), {
        task: "image_alt_text",
        capability: "vision",
      })
      expect(one.status).toBe(200)
    })

    it("refuses more than a text task's input and more than 6 MB, free", async () => {
      const who = await shop()
      const long = chatBody({
        messages: [{ role: "user", content: "a".repeat(64 * 1024 + 1) }],
      })
      expect(refusalOf(await callAs(http, who, long))).toEqual(refused(413, "body_too_large"))
      // Past the gateway's 6 MB the bytes are not even read to the signature
      const huge = Buffer.alloc(6 * 1024 * 1024 + 1, 0x61)
      const tooLarge = await callAs(http, who, huge, {
        task: "image_alt_text",
        capability: "vision",
      })
      expect([tooLarge.status, tooLarge.headers["x-qt-ai-refusal"]]).toEqual([
        413,
        "body_too_large",
      ])
      expect(jsonOf(tooLarge)["qt_ai_gateway"]).toEqual({ code: "body_too_large" })
      expect(provider.seen).toEqual([])
      await untouched(who)
    })

    it("keeps no content: not the prompt, not the answer, in no table (kabul 10)", async () => {
      const who = await shop()
      const asked = `QT-ISTEK-${randomUUID()}`
      const answered = `QT-YANIT-${randomUUID()}`
      const failed = `QT-HATA-${randomUUID()}`
      const prompt = (extra: Record<string, unknown> = {}) =>
        chatBody({ messages: [{ role: "user", content: `Ürün: ${asked}` }], ...extra })

      // The happy path: the prompt reached the provider, its answer reached the shop
      provider.answer({ status: 200, body: chatAnswer(answered) })
      const happy = await callAs(http, who, prompt())
      expect(happy.status).toBe(200)
      expect(Buffer.from(happy.data).toString("utf8")).toContain(answered)
      expect(provider.seen[0]?.body.toString("utf8")).toContain(asked)

      // A refusal (a tool outside the assistant) and a provider's failure
      expect((await callAs(http, who, prompt({ tools: TOOLS }))).status).toBe(400)
      provider.answer({
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { message: `${failed} ${asked}` } }),
      })
      const broken = await callAs(http, who, prompt())
      expect([broken.status, broken.headers["x-qt-ai-credits-charged"]]).toEqual([500, "0"])

      expect(await tablesHolding(getContainer(), [asked, answered, failed])).toEqual([])
    })
  },
})
