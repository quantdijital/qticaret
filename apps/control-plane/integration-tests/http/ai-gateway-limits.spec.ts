import { request } from "node:http"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { aiGatewayRefusalSchema } from "@qticaret/types/control-plane"
import { BODY_TIMEOUT_ENV } from "../../src/api/http/raw-body"
import { bodyReadsNow, tuneBodyReads } from "../../src/lib/ai-gateway/body-reads"
import {
  AI_GATEWAY_MAX_BODY_READS,
  AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS,
} from "../../src/lib/ai-gateway/limits"
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
import { openCall, until } from "../helpers/open-call"
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
 * The second review's N2: the process reads 16 bodies at once before any
 * signature, the 17th refused 503 before its body, every slot back once
 * the senders hang up.
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
    const base = () => new URL(String((api as { defaults: { baseURL?: string } }).defaults.baseURL))

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

    /** Bodies of `count` calls left half sent, `bytes` each, from `host` (default the API's). */
    const slowCalls = (who: Awaited<ReturnType<typeof shop>>, count: number, host?: string) =>
      Array.from({ length: count }, () =>
        openCall(base(), signedCall(who, chatBody()), 10, host === undefined ? {} : { host })
      )

    it("reads 16 bodies at once, whoever sends them; the 17th is 503 before its body", async () => {
      const who = await shop()
      // Every test call comes from one address: its own limit lifted, the pace never checked
      tuneBodyReads({ perAddress: AI_GATEWAY_MAX_BODY_READS, graceMs: 60_000 })
      try {
        // Well-formed headers, a body that never ends: the signature is never checked
        const slow = slowCalls(who, AI_GATEWAY_MAX_BODY_READS)
        await until(() => bodyReadsNow() === AI_GATEWAY_MAX_BODY_READS)
        const busy = openCall(base(), signedCall(who, chatBody()), 0)
        const answer = await busy.answered
        expect([answer.status, answer.headers["x-qt-ai-refusal"]]).toEqual([503, "unavailable"])
        expect(aiGatewayRefusalSchema.safeParse(JSON.parse(answer.body)).success).toBe(true)
        expect(slow.some((call) => call.done())).toBe(false)
        busy.client.destroy()
        // The senders gone: every slot back, the next call read and sent
        for (const call of slow) {
          call.client.destroy()
        }
        await until(() => bodyReadsNow() === 0)
      } finally {
        tuneBodyReads(null)
      }
      expect((await callAs(http, who, chatBody())).status).toBe(200)
      expect(provider.seen).toHaveLength(1)
    })

    it("reads four bodies at once from one address; the fifth is 503, another address read", async () => {
      const who = await shop()
      tuneBodyReads({ graceMs: 60_000 })
      try {
        // 127.0.0.1 and ::1 are two client addresses to the gateway
        const slow = slowCalls(who, AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS, "127.0.0.1")
        await until(() => bodyReadsNow() === AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS)
        const busy = openCall(base(), signedCall(who, chatBody()), 0, { host: "127.0.0.1" })
        const answer = await busy.answered
        expect([answer.status, answer.headers["x-qt-ai-refusal"]]).toEqual([503, "unavailable"])
        // The process was far from its 16: the address's own limit refused it
        expect(bodyReadsNow()).toBe(AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS)
        busy.client.destroy()
        const call = signedCall(who, chatBody())
        const other = openCall(base(), call, call.bytes.length, { host: "::1" })
        other.client.end()
        expect((await other.answered).status).toBe(200)
        for (const sent of slow) {
          sent.client.destroy()
        }
        await until(() => bodyReadsNow() === 0)
      } finally {
        tuneBodyReads(null)
      }
      expect(provider.seen).toHaveLength(1)
    })
  },
})
