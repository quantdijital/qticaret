import { request } from "node:http"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { aiGatewayRefusalSchema } from "@qticaret/types/control-plane"
import { BODY_TIMEOUT_ENV } from "../../src/api/http/raw-body"
import { ensureSigningKey } from "../helpers/fleet"
import { walletOf } from "../helpers/ai-credits"
import {
  callAs,
  chatAnswer,
  chatBody,
  jsonOf,
  signedCall,
  startFakeProvider,
} from "../helpers/ai-provider"
import type { CallReply, FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

/**
 * Security review of P3b, O2: what the gateway refuses before it holds a
 * body or a provider's time. A request whose signature's headers are
 * missing, broken or stale is refused before a byte of its body is read
 * (a 6 MB unsigned body gets the guard's 401, not a 413); a body slower
 * than its time is answered 408; a shop holds four calls in flight, the
 * fifth refused `busy` (429) with no credit taken, its slot back once a
 * call ends. Every refusal of the gateway's own is its strict envelope.
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
    const messageOf = (reply: CallReply) => [reply.status, jsonOf(reply)["message"]]
    const strict = (reply: CallReply) => aiGatewayRefusalSchema.safeParse(jsonOf(reply)).success

    it("refuses a call with no, a broken or a stale signature before its body", async () => {
      const who = await shop()
      const huge = Buffer.alloc(6 * 1024 * 1024 + 1, 0x61)
      const unsigned = await callAs(http, who, huge, { unsigned: true })
      expect(messageOf(unsigned)).toEqual([401, "signature.malformed"])
      const broken = await callAs(http, who, chatBody(), { extra: { "x-qt-nonce": "short" } })
      expect(messageOf(broken)).toEqual([401, "signature.malformed"])
      const stale = await callAs(http, who, huge, { extra: { "x-qt-timestamp": "1000" } })
      expect(messageOf(stale)).toEqual([401, "signature.stale"])
      // Signed and on time, past 6 MB: the gateway's own 413, its envelope strict
      const tooLarge = await callAs(http, who, huge, {
        task: "image_alt_text",
        capability: "vision",
      })
      expect([tooLarge.status, tooLarge.headers["x-qt-ai-refusal"], strict(tooLarge)]).toEqual([
        413,
        "body_too_large",
        true,
      ])
      expect(provider.seen).toEqual([])
    })

    it("answers 408 to a body slower than its time", async () => {
      const who = await shop()
      process.env[BODY_TIMEOUT_ENV] = "300"
      try {
        const call = signedCall(who, chatBody())
        const base = new URL(String((api as { defaults: { baseURL?: string } }).defaults.baseURL))
        const status = await new Promise<number>((resolve, reject) => {
          const sent = request(
            {
              host: base.hostname,
              port: base.port,
              path: call.path,
              method: "POST",
              headers: { ...call.headers, "content-length": String(call.bytes.length) },
            },
            (res) => {
              res.resume()
              resolve(res.statusCode ?? 0)
            }
          )
          sent.on("error", reject)
          // Half the body, then nothing
          sent.write(call.bytes.subarray(0, 10))
        })
        expect(status).toBe(408)
      } finally {
        Reflect.deleteProperty(process.env, BODY_TIMEOUT_ENV)
      }
      expect(provider.seen).toEqual([])
    })

    it("holds a shop to four calls in flight; the fifth is busy, free", async () => {
      const who = await shop()
      provider.answer({ delayMs: 1_500, body: chatAnswer() })
      const replies = await Promise.all(
        Array.from({ length: 5 }, () => callAs(http, who, chatBody()))
      )
      const statuses = replies.map((reply) => reply.status).sort()
      expect(statuses).toEqual([200, 200, 200, 200, 429])
      const busy = replies.find((reply) => reply.status === 429)
      expect([busy?.headers["x-qt-ai-refusal"], busy && strict(busy)]).toEqual(["busy", true])
      expect(busy?.headers["x-qt-ai-credits-charged"]).toBeUndefined()
      expect(provider.seen).toHaveLength(4)
      const charged = replies.reduce(
        (sum, reply) => sum + Number(reply.headers["x-qt-ai-credits-charged"] ?? 0),
        0
      )
      const wallet = await walletOf(getContainer(), who.id)
      expect(wallet?.spent_today).toBe(charged)
      // The slots came back: the next call goes
      provider.answer({})
      expect((await callAs(http, who, chatBody())).status).toBe(200)
    })
  },
})
