import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { bodyReadsNow, tuneBodyReads } from "../../src/lib/ai-gateway/body-reads"
import { ensureSigningKey } from "../helpers/fleet"
import { chatBody, signedCall, startFakeProvider } from "../helpers/ai-provider"
import type { FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import { openCall, pause, until } from "../helpers/open-call"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

/**
 * Third security review of P3b, O1: a body the gateway reads before any
 * signature is checked must say its length and keep a pace. One with no
 * `content-length` is refused 411 before a byte is read; one dripped
 * slower than 32 KB a second is answered 408 a few seconds in, its slot
 * back; a body near 6 MB sent at an ordinary pace is read whole and sent.
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
    afterEach(() => {
      tuneBodyReads(null)
    })

    const shop = () => aiShop(http, getContainer(), owner, { monthly: 100 })
    const base = () => new URL(String((api as { defaults: { baseURL?: string } }).defaults.baseURL))

    it("refuses a call with no content-length before its body", async () => {
      const who = await shop()
      // Chunked, its body begun and never ended: no slot is taken
      const sent = openCall(base(), signedCall(who, chatBody()), 10, { chunked: true })
      const answer = await sent.answered
      expect(answer.status).toBe(411)
      expect(JSON.parse(answer.body)).toMatchObject({
        type: "invalid_data",
        message: "errors.length_required",
      })
      expect(bodyReadsNow()).toBe(0)
      sent.client.destroy()
      expect(provider.seen).toEqual([])
    })

    it("cuts a body dripped slower than its pace a few seconds in, its slot back", async () => {
      const who = await shop()
      const call = signedCall(who, chatBody())
      const started = Date.now()
      const sent = openCall(base(), call, 10)
      // Ten bytes every quarter second: 40 bytes a second, far under 32 KB
      let at = 10
      const drip = setInterval(() => {
        if (at < call.bytes.length - 10) {
          sent.client.write(call.bytes.subarray(at, at + 10))
          at += 10
        }
      }, 250)
      try {
        await until(() => bodyReadsNow() === 1)
        const answer = await sent.answered
        const spent = Date.now() - started
        expect(answer.status).toBe(408)
        expect(answer.headers.connection).toBe("close")
        // Past its 2 s grace, within a check or two of it
        expect(spent).toBeGreaterThanOrEqual(1_900)
        expect(spent).toBeLessThan(3_500)
      } finally {
        clearInterval(drip)
      }
      await until(() => bodyReadsNow() === 0)
      sent.client.destroy()
      expect(provider.seen).toEqual([])
    })

    it("reads a body near 6 MB sent at an ordinary pace whole, past its grace", async () => {
      const who = await shop()
      // The grace short, so the pace is checked while this body arrives
      tuneBodyReads({ graceMs: 200, paceCheckMs: 50 })
      const picture = Buffer.alloc(4_400_000, 0x89).toString("base64")
      const body = JSON.stringify({
        model: "fake-vision",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Alt metin yaz." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${picture}` } },
            ],
          },
        ],
        max_tokens: 100,
      })
      expect(body.length).toBeGreaterThan(5_800_000)
      const call = signedCall(who, body, { task: "image_alt_text", capability: "vision" })
      const sent = openCall(base(), call, 0)
      // Eight parts a tenth of a second apart: ~7 MB a second, the read past its grace
      const part = Math.ceil(call.bytes.length / 8)
      for (let at = 0; at < call.bytes.length; at += part) {
        sent.client.write(call.bytes.subarray(at, at + part))
        await pause(100)
      }
      sent.client.end()
      const answer = await sent.answered
      expect(answer.status).toBe(200)
      expect(provider.seen).toHaveLength(1)
      await until(() => bodyReadsNow() === 0)
    })
  },
})
