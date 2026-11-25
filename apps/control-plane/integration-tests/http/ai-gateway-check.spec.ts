import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { writeProviderKey } from "../../src/lib/ai-gateway/keys"
import { FAKE_URL_ENV } from "../../src/lib/ai-gateway/target"
import { pgOf } from "../helpers/ai-credits"
import { startFakeProvider } from "../helpers/ai-provider"
import type { FakeProvider } from "../helpers/ai-provider"
import { anyStatus, makeMember } from "../helpers/staff"
import type { Answer, HttpClient, Member } from "../helpers/staff"
import { auditRows, client } from "../helpers/tenants"
import { captureOutput, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

const T = "/admin/cp/ai/providers/fake/test"
const MODELS = JSON.stringify({ object: "list", data: [{ id: "fake-text", object: "model" }] })

/**
 * "Bağlantıyı dene" (adr/0085 §2): the owner tries the platform's key for
 * a service on its model list. The answer is a verdict alone; the key is
 * in no answer, log or table; no credit moves; the audit row keeps the
 * service and the verdict; six a minute per member.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let provider: FakeProvider

    beforeAll(async () => {
      provider = await startFakeProvider()
    })
    afterAll(async () => {
      await provider.close()
    })

    const owner = () => makeMember(http, getContainer(), "owner")
    const check = (member: Member, path = T) => call.post(path, {}, member)
    const ledgerRows = async () =>
      (await pgOf(getContainer()).raw("SELECT count(*)::int AS n FROM ai_credit_entry")).rows[0]?.[
        "n"
      ]

    it("answers the owner alone, and an unknown service with 404", async () => {
      for (const role of ["operator", "finance", "readonly"] as const) {
        const member = await makeMember(http, getContainer(), role)
        expect([role, (await check(member)).status]).toEqual([role, 403])
      }
      const member = await owner()
      for (const path of [
        "/admin/cp/ai/providers/nobody/test",
        "/admin/cp/ai/providers/FAKE/test",
        "/admin/cp/ai/providers/%66ake/test",
      ]) {
        expect([path, (await check(member, path)).status]).toEqual([path, 404])
      }
      expect((await call.post(T, { api_key: "x" }, member)).status).toBe(400)
      expect(provider.seen).toEqual([])
    })

    it("says no_key without a key, and calls nobody", async () => {
      const answer = await check(await owner())
      expect([answer.status, answer.data]).toEqual([200, { ok: false, reason: "no_key" }])
      expect(answer.headers["cache-control"]).toBe("no-store")
      expect(provider.seen).toEqual([])
    })

    it("judges the provider's answer and repeats none of it", async () => {
      const secret = `test-key-${randomUUID()}`
      await writeProviderKey(getContainer(), "fake", secret)
      const member = await owner()
      const before = await ledgerRows()
      provider.answer(
        { status: 200, body: MODELS },
        {
          status: 401,
          headers: { "x-provider-note": secret },
          body: JSON.stringify({ error: { message: `Incorrect API key provided: ${secret}` } }),
        },
        { status: 503, body: "busy" },
        { status: 200, body: `{"echo":"${secret}"}` },
        { status: 302, headers: { location: "https://example.com/" }, body: "" }
      )
      const answers: Answer[] = []
      const { output } = await captureOutput(async () => {
        for (let i = 0; i < 5; i += 1) {
          answers.push(await check(member))
        }
      })
      expect(answers.map((each) => each.data)).toEqual([
        { ok: true },
        { ok: false, reason: "rejected" },
        { ok: false, reason: "unreachable" },
        { ok: false, reason: "unexpected" },
        { ok: false, reason: "unexpected" },
      ])
      // The key went in its header only, to the list's path, with nothing else
      const seen = provider.seen.slice(-5)
      expect(seen.map((each) => each.path)).toEqual(Array(5).fill("/models"))
      expect(seen[0]?.headers.authorization).toBe(`Bearer ${secret}`)
      expect(seen[0]?.body.length).toBe(0)
      const told = JSON.stringify(answers.map((each) => [each.data, each.headers]))
      for (const text of [told, output]) {
        expect(text).not.toContain(secret)
        expect(text).not.toContain("Incorrect API key")
      }
      expect(await tablesHolding(getContainer(), [secret])).toEqual([])
      expect(await ledgerRows()).toBe(before)
      const audited = await auditRows(getContainer(), {
        action: "POST /admin/cp/ai/providers/:service/test",
        outcome: 200,
      })
      expect(audited.slice(-5).map((row) => row.changes)).toEqual(
        ["ok", "rejected", "unreachable", "unexpected", "unexpected"].map((result): unknown =>
          expect.objectContaining({ check: { result } })
        )
      )
      expect(audited.at(-1)?.resource_id).toBe("fake")
    })

    it("says unreachable when nothing answers", async () => {
      const kept = process.env[FAKE_URL_ENV]
      await writeProviderKey(getContainer(), "fake", `test-key-${randomUUID()}`)
      process.env[FAKE_URL_ENV] = "http://127.0.0.1:9299/"
      try {
        expect((await check(await owner())).data).toEqual({ ok: false, reason: "unreachable" })
      } finally {
        process.env[FAKE_URL_ENV] = kept
      }
    })

    it("takes six a minute from one member, then 429", async () => {
      provider.answer({ status: 200, body: MODELS })
      const member = await owner()
      for (let i = 0; i < 6; i += 1) {
        expect((await check(member)).status).toBe(200)
      }
      const over = await check(member)
      expect(over.status).toBe(429)
      expect(over.headers["retry-after"]).toBeDefined()
      // Another member is counted apart
      expect((await check(await owner())).status).toBe(200)
      expect((await http.post(T, {}, { ...anyStatus, headers: member.headers })).status).toBe(429)
    })
  },
})
