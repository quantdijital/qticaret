import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { aiGatewayRefusalSchema } from "@qticaret/types/control-plane"
import { ensureSigningKey } from "../helpers/fleet"
import { pgOf, walletOf } from "../helpers/ai-credits"
import { callAs, chatBody, jsonOf, startFakeProvider } from "../helpers/ai-provider"
import type { CallReply, FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { captureOutput } from "../helpers/vault"

jest.setTimeout(240 * 1000)

/**
 * Security review of P3b, D2 and D3 (adr/0085 "Ek (P3b)"): a provider's
 * failure reaches a shop as its status alone (the platform's account
 * details in its words never do); a 2xx the shop cannot read is no
 * answer (502, the credits kept: the work may be done); a model gone or
 * the platform's key refused in a 400 is the platform's failure: the
 * credits come back, the shop is told `unavailable`, the log names the
 * service and the status only.
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
    const statusOf = async (operationId: string) =>
      (
        await pgOf(getContainer()).raw(
          `SELECT status FROM ai_credit_operation WHERE operation_id = ?`,
          [operationId]
        )
      ).rows[0]?.["status"]
    const charged = (reply: CallReply) => reply.headers["x-qt-ai-credits-charged"]
    const ACCOUNT = `quota project-${randomUUID()} balance 12.40 USD`

    it("passes a failure's status, never its words", async () => {
      const who = await shop()
      const operation = randomUUID()
      provider.answer({
        status: 400,
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ error: { message: ACCOUNT }, base_resp: { status_code: 2013 } }),
      })
      const reply = await callAs(http, who, chatBody(), { operation })
      expect([
        reply.status,
        reply.headers["content-type"],
        reply.headers["x-qt-ai-refusal"],
      ]).toEqual([400, "application/json", undefined])
      // Only the short code the shop's own mapping reads goes with it
      expect(jsonOf(reply)).toEqual({ error: { code: 400 }, base_resp: { status_code: 2013 } })
      expect([charged(reply), await statusOf(operation)]).toEqual(["1", "charged"])
    })

    it("takes a 2xx the shop cannot read for no answer, the credits kept", async () => {
      const who = await shop()
      const operation = randomUUID()
      provider.answer({ status: 200, headers: { "content-type": "text/html" }, body: "<p>hi</p>" })
      const reply = await callAs(http, who, chatBody(), { operation })
      expect([reply.status, reply.headers["x-qt-ai-refusal"], charged(reply)]).toEqual([
        502,
        "provider_unreachable",
        "1",
      ])
      expect(aiGatewayRefusalSchema.safeParse(jsonOf(reply)).success).toBe(true)
      expect(await statusOf(operation)).toBe("charged")
    })

    it("gives back the platform's own failure and tells the shop unavailable", async () => {
      const who = await shop()
      const failures = [
        { status: 404, body: JSON.stringify({ error: { message: `model gone ${ACCOUNT}` } }) },
        {
          status: 400,
          body: JSON.stringify({
            error: {
              code: 400,
              message: `API key not valid. ${ACCOUNT}`,
              status: "INVALID_ARGUMENT",
              details: [{ reason: "API_KEY_INVALID" }],
            },
          }),
        },
      ]
      for (const failure of failures) {
        const operation = randomUUID()
        provider.answer(failure)
        const { result: reply, output } = await captureOutput(
          () => callAs(http, who, chatBody(), { operation }),
          getContainer()
        )
        expect([reply.status, reply.headers["x-qt-ai-refusal"], charged(reply)]).toEqual([
          503,
          "unavailable",
          "0",
        ])
        expect(jsonOf(reply)).toEqual({ qt_ai_gateway: { code: "unavailable" } })
        expect(await statusOf(operation)).toBe("released")
        // The operator sees the service and the status; the body never
        expect(output).toContain('"platform_fault":true')
        expect(output).toContain(`"outcome":${String(failure.status)}`)
        expect(output).not.toContain(ACCOUNT)
      }
      expect(await walletOf(getContainer(), who.id)).toMatchObject({ plan_balance: 100 })
    })
  },
})
