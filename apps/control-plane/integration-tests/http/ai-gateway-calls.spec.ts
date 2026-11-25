import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { aiCallResponseHeadersSchema } from "@qticaret/types/control-plane"
import { ensureSigningKey } from "../helpers/fleet"
import { pgOf, walletOf } from "../helpers/ai-credits"
import {
  CALLS,
  callAs,
  chatAnswer,
  chatBody,
  jsonOf,
  startFakeProvider,
} from "../helpers/ai-provider"
import type { FakeProvider } from "../helpers/ai-provider"
import { TEST_KEY, aiShop, routeAll } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { captureOutput, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

/**
 * adr/0085 §2: `POST /tenant-api/v1/ai/calls`, the gateway's happy path
 * against a fake provider on the loopback. The credits are taken once,
 * the provider gets the routing's model, the task's output budget and the
 * platform's key in its own header and none of the shop's headers; the
 * shop gets the provider's status, type and bytes, the credit headers,
 * and none of the provider's headers; the operation is settled with its
 * measures before the answer leaves.
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

    const shop = (monthly = 100) => aiShop(http, getContainer(), owner, { monthly })
    const operationOf = async (operationId: string) =>
      (
        await pgOf(getContainer()).raw(
          `SELECT status, calls, credits, service, model, input_tokens, output_tokens, images,
                  estimated_cost_micros
             FROM ai_credit_operation WHERE operation_id = ?`,
          [operationId]
        )
      ).rows[0]

    it("charges once, sends the platform's model, budget and key, and passes the answer on", async () => {
      const who = await shop()
      const operation = randomUUID()
      provider.answer({
        status: 200,
        headers: {
          "set-cookie": "provider=1",
          "x-qt-ai-credits-balance": "999999",
          "x-qt-ai-refusal": "none",
          "x-ratelimit-remaining-requests": "42",
          "openai-organization": "org-x",
        },
        body: chatAnswer("Şam Çeliği Şef Bıçağı"),
      })
      const { result: reply, output } = await captureOutput(
        () =>
          callAs(http, who, chatBody({ model: "gpt-dear-9", max_tokens: 50_000, stream: true }), {
            operation,
            extra: {
              authorization: "Bearer shop-own-key",
              cookie: "sid=shop",
              "x-api-key": "shop-x-api-key",
              "x-goog-api-key": "shop-goog-key",
              "x-qt-custom": "shop",
              // The old headers name nothing now: only the signed query does
              "x-qt-ai-task": "post_draft",
              "x-qt-ai-capability": "vision",
              "x-qt-ai-operation": "not-a-uuid",
              "x-forwarded-for": "10.0.0.1",
            },
          }),
        // The logger itself, wherever it writes (CI's console is silenced)
        getContainer()
      )

      // The provider's answer as it came: status, type, bytes
      expect(reply.status).toBe(200)
      expect(Buffer.from(reply.data).toString("utf8")).toBe(chatAnswer("Şam Çeliği Şef Bıçağı"))
      expect(reply.headers["content-type"]).toBe("application/json")
      expect(
        aiCallResponseHeadersSchema.parse({
          "x-qt-ai-credits-charged": reply.headers["x-qt-ai-credits-charged"],
          "x-qt-ai-credits-balance": reply.headers["x-qt-ai-credits-balance"],
        })
      ).toEqual({ "x-qt-ai-credits-charged": 1, "x-qt-ai-credits-balance": 99 })
      // None of the provider's own headers
      expect(reply.headers["set-cookie"]).toBeUndefined()
      expect(reply.headers["x-qt-ai-refusal"]).toBeUndefined()
      expect(reply.headers["x-ratelimit-remaining-requests"]).toBeUndefined()
      expect(reply.headers["openai-organization"]).toBeUndefined()

      // What the provider got: the platform's key in its header, the routing's model,
      // the task's budget, no stream, and nothing of the shop's headers
      expect(provider.seen).toHaveLength(1)
      const [sent] = provider.seen
      expect(sent?.path).toBe("/chat")
      expect(sent?.headers.authorization).toBe(`Bearer ${TEST_KEY}`)
      const forbidden = Object.keys(sent?.headers ?? {}).filter(
        (name) =>
          name.startsWith("x-qt-") ||
          ["cookie", "x-api-key", "x-goog-api-key", "x-forwarded-for"].includes(name)
      )
      expect(forbidden).toEqual([])
      expect(JSON.stringify(sent?.headers)).not.toContain("shop")
      const body = JSON.parse(sent?.body.toString("utf8") ?? "{}") as Record<string, unknown>
      expect(body).toMatchObject({ model: "fake-text", max_tokens: 360, stream: false })

      // Charged once, settled with its measures before the answer left
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 99 })
      expect(await operationOf(operation)).toMatchObject({
        status: "charged",
        calls: 1,
        credits: 1,
        service: "fake",
        model: "fake-text",
        input_tokens: 120,
        output_tokens: 30,
        images: null,
        // 120 × 1 $ + 30 × 2 $ per million tokens: 180 millionths
        estimated_cost_micros: 180,
      })
      // The log holds the meta, never the key, the prompt or the answer
      expect(output).toContain("cp.ai_gateway_call")
      for (const words of [TEST_KEY, "Şam çeliği", "Şam Çeliği", "Bir SEO"]) {
        expect(output).not.toContain(words)
      }
      expect(await tablesHolding(getContainer(), [TEST_KEY, "Şam Çeliği", "SEO başlığı"])).toEqual(
        []
      )
    })

    it("passes a picture form on as its exact bytes, to the scene's endpoint", async () => {
      const who = await shop(100)
      const picture = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 256))
      const boundary = "qtboundary0123"
      const form = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\ncontent-disposition: form-data; name="imageFile"; filename="a.png"\r\n` +
            "content-type: image/png\r\n\r\n"
        ),
        picture,
        Buffer.from(
          `\r\n--${boundary}\r\ncontent-disposition: form-data; name="background.prompt"\r\n\r\n` +
            `Mermer tezgâh\r\n--${boundary}--\r\n`
        ),
      ])
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255])
      provider.answer({ status: 200, headers: { "content-type": "image/png" }, body: png })
      const operation = randomUUID()
      const reply = await callAs(http, who, form, {
        task: "image_scene",
        capability: "image_edit",
        operation,
        // Spelled as a client may: the provider is sent the type as the gateway writes it (N3)
        contentType: `Multipart/Form-Data;boundary="${boundary}"`,
      })
      expect(reply.status).toBe(200)
      expect(reply.headers["content-type"]).toBe("image/png")
      expect(Buffer.from(reply.data).equals(png)).toBe(true)
      expect(reply.headers["x-qt-ai-credits-charged"]).toBe("40")
      const [sent] = provider.seen
      expect(sent?.path).toBe("/scene")
      expect(sent?.body.equals(form)).toBe(true)
      expect(sent?.headers["content-type"]).toBe(`multipart/form-data; boundary=${boundary}`)
      expect(sent?.headers["x-api-key"]).toBe(TEST_KEY)
      expect(sent?.headers.authorization).toBeUndefined()
      expect(await operationOf(operation)).toMatchObject({
        status: "charged",
        credits: 40,
        model: "fake-scene",
        images: 1,
        estimated_cost_micros: 1_000,
      })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 60 })
    })

    it("adds an operation's later calls' measures to it, charging once (P3d, D4)", async () => {
      const who = await shop(100)
      const operation = randomUUID()
      provider.answer(
        { body: chatAnswer("Bir", { prompt_tokens: 120, completion_tokens: 30 }) },
        { body: chatAnswer("İki", { prompt_tokens: 200, completion_tokens: 50 }) },
        { body: chatAnswer("Üç", { prompt_tokens: 80, completion_tokens: 20 }) }
      )
      const charged: unknown[] = []
      for (let i = 0; i < 3; i += 1) {
        const reply = await callAs(http, who, chatBody(), { operation })
        expect(reply.status).toBe(200)
        charged.push(reply.headers["x-qt-ai-credits-charged"])
      }
      expect(charged).toEqual(["1", "0", "0"])
      // A fourth is past the task's calls: refused, nothing added
      expect((await callAs(http, who, chatBody(), { operation })).status).not.toBe(200)
      expect(await operationOf(operation)).toMatchObject({
        status: "charged",
        calls: 3,
        credits: 1,
        model: "fake-text",
        input_tokens: 400,
        output_tokens: 100,
        images: null,
        // (120 + 200 + 80) × 1 $ + (30 + 50 + 20) × 2 $ per million tokens
        estimated_cost_micros: 600,
      })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 99 })
    })

    it("answers its own refusal apart from a provider's: a marker, an envelope, its status", async () => {
      const who = await shop(0)
      const reply = await callAs(http, who, chatBody())
      expect(reply.status).toBe(402)
      expect(reply.headers["x-qt-ai-refusal"]).toBe("credits_exhausted")
      expect(jsonOf(reply)).toEqual({ qt_ai_gateway: { code: "credits_exhausted" } })
      expect(provider.seen).toHaveLength(0)
      expect(CALLS).toBe("/tenant-api/v1/ai/calls")
    })
  },
})
