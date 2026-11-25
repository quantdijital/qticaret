import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { FAKE_TIMEOUT_ENV, FAKE_URL_ENV } from "../../src/lib/ai-gateway/target"
import { ensureSigningKey } from "../helpers/fleet"
import { pgOf, walletOf } from "../helpers/ai-credits"
import { callAs, chatBody, jsonOf, startFakeProvider } from "../helpers/ai-provider"
import type { FakeProvider } from "../helpers/ai-provider"
import { TEST_KEY, aiShop, routeAll } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { captureOutput } from "../helpers/vault"

jest.setTimeout(240 * 1000)

/**
 * adr/0085 kabul testleri 2 ve 3, and the operation's life when the
 * provider fails: a call the provider never took (5xx, 401/403, 402, 429,
 * no connection) gives its credits back with a `release` row; one it may
 * have done (400, a timeout, a reset) keeps them; a refused key's answer
 * never reaches the shop; the same operation's later calls cost nothing up
 * to the cap; the operation is closed even when the shop hangs up; two
 * calls of one operation at once, the first refused, lose no credit and
 * get none free (P2 O1, end to end).
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
    const pg = () => pgOf(getContainer())
    const operationOf = async (operationId: string) =>
      (
        await pg().raw(`SELECT status, calls FROM ai_credit_operation WHERE operation_id = ?`, [
          operationId,
        ])
      ).rows[0]
    const entriesOf = async (operationId: string) =>
      (
        await pg().raw(
          `SELECT kind, amount FROM ai_credit_entry WHERE operation_id = ? ORDER BY created_at, kind`,
          [operationId]
        )
      ).rows

    it.each([500, 503, 401, 403, 402, 429])(
      "gives the credits back when the provider answers %s",
      async (status) => {
        const who = await shop()
        const operation = randomUUID()
        provider.answer({ status, body: JSON.stringify({ error: { message: "no" } }) })
        const reply = await callAs(http, who, chatBody(), { operation })
        expect(reply.headers["x-qt-ai-credits-charged"]).toBe("0")
        expect(reply.headers["x-qt-ai-credits-balance"]).toBe("100")
        if (status === 401 || status === 403) {
          // A refused key's words never reach the shop
          expect(reply.status).toBe(503)
          expect(jsonOf(reply)).toEqual({ qt_ai_gateway: { code: "unavailable" } })
        } else {
          expect(reply.status).toBe(status)
          expect(reply.headers["x-qt-ai-refusal"]).toBeUndefined()
          expect(jsonOf(reply)).toEqual({ error: { message: "no" } })
        }
        expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 100 })
        expect(await operationOf(operation)).toMatchObject({ status: "released" })
        expect(await entriesOf(operation)).toEqual([
          { kind: "spend", amount: -1 },
          { kind: "release", amount: 1 },
        ])
        // A given back operation's id takes no further call
        expect((await callAs(http, who, chatBody(), { operation })).status).toBe(409)
      }
    )

    it("never passes on an answer that quotes the key, nor logs it", async () => {
      const who = await shop()
      const { result, output } = await captureOutput(async () => {
        provider.answer({ status: 401, body: `Incorrect API key provided: ${TEST_KEY}` })
        const refused = await callAs(http, who, chatBody())
        provider.answer({ status: 200, body: JSON.stringify({ echo: TEST_KEY }) })
        const echoed = await callAs(http, who, chatBody())
        return [refused, echoed]
      }, getContainer())
      // The lines were seen, so their lacking the key means something
      expect(output).toContain("cp.ai_gateway_call")
      for (const reply of result) {
        expect(reply.status).toBe(503)
        expect(Buffer.from(reply.data).toString("utf8")).not.toContain(TEST_KEY.slice(9))
        expect(JSON.stringify(reply.headers)).not.toContain(TEST_KEY.slice(9))
      }
      expect(output).not.toContain(TEST_KEY.slice(9))
    })

    it("keeps the credits when the provider may have done the work", async () => {
      const who = await shop()
      const bad = randomUUID()
      provider.answer({ status: 400, body: JSON.stringify({ error: "bad" }) })
      expect((await callAs(http, who, chatBody(), { operation: bad })).status).toBe(400)
      expect(await operationOf(bad)).toMatchObject({ status: "charged" })

      // A reset after the request left: maybe billed, so kept
      const reset = randomUUID()
      provider.answer({ drop: true })
      const dropped = await callAs(http, who, chatBody(), { operation: reset })
      expect([dropped.status, dropped.headers["x-qt-ai-refusal"]]).toEqual([
        502,
        "provider_unreachable",
      ])
      expect(dropped.headers["x-qt-ai-credits-charged"]).toBe("1")
      expect(await operationOf(reset)).toMatchObject({ status: "charged" })

      // Past its time: abandoned, the credits stay and the operation is closed charged
      const late = randomUUID()
      process.env[FAKE_TIMEOUT_ENV] = "300"
      try {
        provider.answer({ delayMs: 1_500 })
        const timedOut = await callAs(http, who, chatBody(), { operation: late })
        expect([timedOut.status, timedOut.headers["x-qt-ai-refusal"]]).toEqual([
          504,
          "provider_timeout",
        ])
        expect(timedOut.headers["x-qt-ai-credits-charged"]).toBe("1")
      } finally {
        Reflect.deleteProperty(process.env, FAKE_TIMEOUT_ENV)
      }
      expect(await operationOf(late)).toMatchObject({ status: "charged" })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 97 })
    })

    it("gives back a call that never connected", async () => {
      const who = await shop()
      const operation = randomUUID()
      const before = process.env[FAKE_URL_ENV]
      // Nothing listens there (a closed port refuses)
      process.env[FAKE_URL_ENV] = "http://127.0.0.1:9299/"
      try {
        const reply = await callAs(http, who, chatBody(), { operation })
        expect([reply.status, reply.headers["x-qt-ai-refusal"]]).toEqual([
          502,
          "provider_unreachable",
        ])
        expect(reply.headers["x-qt-ai-credits-charged"]).toBe("0")
      } finally {
        process.env[FAKE_URL_ENV] = before
      }
      expect(await operationOf(operation)).toMatchObject({ status: "released" })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 100 })
    })

    it("charges an operation once; its later calls cost nothing up to the cap", async () => {
      const who = await shop()
      const operation = randomUUID()
      const charged: unknown[] = []
      for (let call = 0; call < 3; call += 1) {
        const reply = await callAs(http, who, chatBody(), { operation })
        expect(reply.status).toBe(200)
        charged.push(reply.headers["x-qt-ai-credits-charged"])
      }
      expect(charged).toEqual(["1", "0", "0"])
      const over = await callAs(http, who, chatBody(), { operation })
      expect([over.status, over.headers["x-qt-ai-refusal"]]).toEqual([409, "call_cap"])
      expect(provider.seen).toHaveLength(3)
      expect(await operationOf(operation)).toMatchObject({ status: "charged", calls: 3 })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 99 })
    })

    it("closes the operation though the shop hangs up before the answer", async () => {
      const who = await shop()
      const operation = randomUUID()
      provider.answer({ delayMs: 1_500 })
      const hungUp = await callAs(http, who, chatBody(), { operation, timeoutMs: 300 }).catch(
        (error: unknown) => error
      )
      expect(hungUp).toBeInstanceOf(Error)
      // The gateway goes on: the provider answers, the operation is settled
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline && (await operationOf(operation))?.["status"] !== "charged") {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      expect(await operationOf(operation)).toMatchObject({ status: "charged", calls: 1 })
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 99 })
    })

    it("loses no credit and gives none free when two calls of one operation race", async () => {
      for (let round = 0; round < 3; round += 1) {
        const who = await shop()
        const operation = randomUUID()
        // The first request the provider sees is refused (not taken), the second answered
        provider.answer({ status: 429, delayMs: 300 }, { status: 200 })
        const replies = await Promise.all([
          callAs(http, who, chatBody(), { operation }),
          callAs(http, who, chatBody(), { operation }),
        ])
        expect(replies.map((reply) => reply.status).sort()).toEqual([200, 429])
        // One call did work: one credit, kept; never given back, never taken twice
        expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 99 })
        expect(await operationOf(operation)).toMatchObject({ status: "charged", calls: 2 })
        expect(await entriesOf(operation)).toEqual([{ kind: "spend", amount: -1 }])
      }
    })
  },
})
