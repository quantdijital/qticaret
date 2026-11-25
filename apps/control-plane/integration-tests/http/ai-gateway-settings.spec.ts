import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { addMonths } from "../../src/lib/ai-credits/period"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import { grantPurchase } from "../../src/lib/ai-credits/grant"
import { shopId, walletOf } from "../helpers/ai-credits"
import { anyStatus, makeMember } from "../helpers/staff"
import type { Answer, HttpClient, Member } from "../helpers/staff"
import { auditRows, client, proved } from "../helpers/tenants"
import { captureOutput, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

const S = "/admin/cp/ai/settings"
const P = "/admin/cp/ai/providers"

/**
 * adr/0085 §2, §5: the platform's AI settings and the providers' keys,
 * the owner's alone. A key is written, never read back: no answer, log,
 * audit row or table holds it in the clear. The routing names only what
 * the shared target table has; packs get their ids here and are checked;
 * the day's cap and the bought credits' life are read from the settings.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let others: Member[]

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      others = [
        await makeMember(http, getContainer(), "operator"),
        await makeMember(http, getContainer(), "finance"),
        await makeMember(http, getContainer(), "readonly"),
      ]
    })

    const fakeOf = (answer: Answer | undefined) =>
      (answer?.data as { providers: { service: string }[] } | undefined)?.providers.find(
        (each) => each.service === "fake"
      )
    const save = async (body: unknown) => call.post(S, body, owner, await proved(http, owner))
    const writeKey = async (service: string, apiKey: string) =>
      call.post(`${P}/${service}`, { api_key: apiKey }, owner, await proved(http, owner))
    const dropKey = async (service: string) =>
      http.delete(`${P}/${service}`, { ...anyStatus, headers: await proved(http, owner) })

    it("answers every AI route to the owner alone", async () => {
      const routes: [string, string, unknown][] = [
        ["GET", S, undefined],
        ["POST", S, { daily_cap: 10 }],
        ["GET", P, undefined],
        ["POST", `${P}/fake`, { api_key: "test-key-roles-000" }],
        ["DELETE", `${P}/fake`, undefined],
        ["GET", "/admin/cp/ai/orders", undefined],
        ["POST", "/admin/cp/ai/orders/aiord_x/paid", { method: "bank_transfer" }],
        ["POST", "/admin/cp/ai/orders/aiord_x/cancel", {}],
        ["GET", "/admin/cp/tenants/ten_x/ai-credits", undefined],
        ["POST", "/admin/cp/tenants/ten_x/ai-credits/adjust", {}],
        ["POST", "/admin/cp/tenants/ten_x/ai-credits/daily-cap", { daily_cap: 1 }],
      ]
      for (const member of others) {
        const headers = await proved(http, member)
        for (const [method, path, body] of routes) {
          const answer =
            method === "GET"
              ? await call.get(path, member, headers)
              : method === "DELETE"
                ? await http.delete(path, { ...anyStatus, headers })
                : await call.post(path, body, member, headers)
          expect([method, path, answer.status]).toEqual([method, path, 403])
        }
      }
      const read = await call.get(S, owner)
      expect(read.status).toBe(200)
      expect(read.data).toMatchObject({
        settings: { daily_cap: 300, purchased_lifetime_months: 12, packs: [], routing: {} },
      })
      // A change without a fresh proof is refused before it is read
      expect((await call.post(S, { daily_cap: 10 }, owner)).status).toBe(428)
    })

    it("checks the packs and the routing, and gives the packs their ids", async () => {
      const pack = { name: "Başlangıç", credits: 500, amount: 9_900, active: true }
      const refused: [unknown, number][] = [
        [{ packs: [{ ...pack, credits: -5 }] }, 400],
        [{ packs: [{ ...pack, credits: 2.5 }] }, 400],
        [{ packs: [{ ...pack, credits: 0 }] }, 400],
        [{ packs: [{ ...pack, amount: -1 }] }, 400],
        [{ packs: [{ ...pack, amount: 10.5 }] }, 400],
        [{ packs: Array.from({ length: 11 }, () => pack) }, 400],
        [{ packs: [{ ...pack, id: "pack_never_made" }] }, 400],
        [{ packs: [{ ...pack, currency: "USD" }] }, 400],
        [{ routing: { text: { service: "openai", model: "gpt" } } }, 400],
        [{ routing: { text: { service: "photoroom", model: "segment-v1" } } }, 400],
        [{ routing: { text: { service: "deepseek", model: "deepseek-pro" } } }, 400],
        [{ routing: { video: { service: "fake", model: "fake-text" } } }, 400],
        [{ daily_cap: -1 }, 400],
        [{ purchased_lifetime_months: 0 }, 400],
        [{}, 400],
      ]
      for (const [body, status] of refused) {
        const answer = await save(body)
        expect([body, answer.status]).toEqual([body, status])
      }
      const keys = (answer: Answer) => (answer.data as { message?: string }).message
      expect(keys(await save({ routing: { text: { service: "openai", model: "x" } } }))).toBe(
        "cp.ai_route_service_unknown"
      )
      expect(
        keys(await save({ routing: { text: { service: "photoroom", model: "segment-v1" } } }))
      ).toBe("cp.ai_route_capability_unsupported")
      expect(
        keys(await save({ routing: { text: { service: "deepseek", model: "deepseek-pro" } } }))
      ).toBe("cp.ai_route_model_not_allowed")
      // A chat whose output no documented field caps (P3b review C1): not on credits
      for (const capability of ["text", "vision"]) {
        const gemini = {
          routing: { [capability]: { service: "gemini", model: "gemini-4-hydrogen" } },
        }
        expect(keys(await save(gemini))).toBe("cp.ai_route_uncapped")
      }
      expect((await call.get(S, owner)).data).toMatchObject({
        settings: { packs: [], routing: {} },
      })
      // P3d: never routed to a service whose key is not held; nothing saved
      const flash = { routing: { text: { service: "deepseek", model: "deepseek-flash" } } }
      const unkeyed = await save(flash)
      expect([unkeyed.status, keys(unkeyed)]).toEqual([409, "cp.ai_route_no_key"])
      const unsaved = (await call.get(S, owner)).data as { settings: { routing: unknown } }
      expect(unsaved.settings.routing).toEqual({})
      expect((await writeKey("deepseek", `test-key-${randomUUID()}`)).status).toBe(200)

      const saved = await save({
        daily_cap: 120,
        purchased_lifetime_months: 6,
        packs: [pack, { ...pack, name: "Büyük", credits: 5_000, amount: 79_900, active: false }],
        routing: { text: { service: "deepseek", model: "deepseek-flash" }, vision: null },
      })
      expect(saved.status).toBe(200)
      const settings = (saved.data as { settings: { packs: { id: string }[] } }).settings
      expect(settings.packs.map((each) => each.id)).toEqual([
        expect.stringMatching(/^pack_[0-9a-f]{16}$/),
        expect.stringMatching(/^pack_[0-9a-f]{16}$/),
      ])
      expect(saved.data).toMatchObject({
        settings: {
          daily_cap: 120,
          purchased_lifetime_months: 6,
          packs: [
            { ...pack, currency: "TRY" },
            { name: "Büyük", active: false },
          ],
          routing: { text: { service: "deepseek", model: "deepseek-flash" } },
        },
      })
      // A kept pack is named by its id and keeps it while its terms stay; one left out is gone
      const [first] = settings.packs
      const kept = await save({ packs: [{ ...pack, id: first?.id, name: "Yeni ad" }] })
      expect(kept.data).toMatchObject({ settings: { packs: [{ id: first?.id, name: "Yeni ad" }] } })
      // New credits or a new amount: a new pack, a new id (PR #371 D3)
      const repriced = await save({ packs: [{ ...pack, id: first?.id, credits: 600 }] })
      const [renewed] = (repriced.data as { settings: { packs: { id: string }[] } }).settings.packs
      expect(renewed?.id).toMatch(/^pack_[0-9a-f]{16}$/)
      expect(renewed?.id).not.toBe(first?.id)
      expect(
        (
          await save({
            packs: [
              { ...pack, id: renewed?.id },
              { ...pack, id: renewed?.id },
            ],
          })
        ).status
      ).toBe(400)

      const audit = await auditRows(getContainer(), { action: `POST ${S}`, outcome: 200 })
      expect(audit[0]?.changes).toMatchObject({
        daily_cap: { from: 300, to: 120 },
        purchased_lifetime_months: { from: 12, to: 6 },
        routing: { from: {}, to: { text: { service: "deepseek", model: "deepseek-flash" } } },
      })
    })

    it("reads the day's cap and the bought credits' life from the settings", async () => {
      expect((await save({ daily_cap: 77, purchased_lifetime_months: 3 })).status).toBe(200)
      const tenantId = shopId()
      const now = new Date()
      expect((await balanceOf(getContainer(), tenantId, now)).daily.cap).toBe(77)
      await grantPurchase(getContainer(), {
        tenantId,
        credits: 10,
        grantRef: `test-${randomUUID()}`,
        actor: "test",
        now,
      })
      const wallet = await walletOf(getContainer(), tenantId)
      expect(wallet?.purchased_expires_at?.getTime()).toBe(addMonths(now, 3).getTime())
    })

    it("writes a key, never shows it, and unroutes its service when it is destroyed", async () => {
      const secret = `test-key-${randomUUID()}`
      const answers: Answer[] = []
      const { output } = await captureOutput(async () => {
        answers.push(await call.get(P, owner))
        // A key too short is refused without being repeated
        answers.push(await writeKey("fake", "test-k"))
        expect(answers.at(-1)?.status).toBe(400)
        expect((await writeKey("nobody", secret)).status).toBe(404)
        answers.push(await writeKey("fake", secret))
        answers.push(await writeKey("fake", `${secret}-2`))
        answers.push(await save({ routing: { text: { service: "fake", model: "fake-text" } } }))
        answers.push(await call.get(P, owner))
        answers.push(await call.get(S, owner))
        answers.push(await dropKey("fake"))
        answers.push(await call.get(P, owner))
        answers.push(await call.get(S, owner))
      }, getContainer())
      const [before, short, first, second, , listed, , dropped, after, settings] = answers
      expect(fakeOf(before)).toEqual({
        service: "fake",
        has_key: false,
        version: null,
        written_at: null,
        routed: [],
      })
      expect(JSON.stringify(short?.data)).not.toContain('test-k"')
      expect(first?.data).toMatchObject({
        provider: { service: "fake", has_key: true, version: 1 },
      })
      expect(second?.data).toMatchObject({ provider: { version: 2 } })
      expect(fakeOf(listed)).toMatchObject({ has_key: true, version: 2, routed: ["text"] })
      expect(dropped?.data).toMatchObject({ deleted: true, unrouted: ["text"] })
      expect(fakeOf(after)).toMatchObject({ has_key: false, version: null })
      expect(settings?.data).toMatchObject({ settings: { routing: {} } })

      // Nowhere: not in an answer, not in the logs, not in any table (audit included)
      const rows = await auditRows(getContainer(), {})
      for (const text of [JSON.stringify(answers.map((each) => each.data)), output]) {
        expect(text).not.toContain(secret)
        expect(text).not.toContain(secret.slice(9, 25))
      }
      expect(await tablesHolding(getContainer(), [secret, secret.slice(9, 25)])).toEqual([])
      expect(rows.some((row) => row.action === `POST ${P}/:service`)).toBe(true)
      const keyRows = await auditRows(getContainer(), {
        action: `POST ${P}/:service`,
        outcome: 200,
      })
      expect(keyRows.map((row) => row.changes)).toEqual([
        expect.objectContaining({ fields: ["api_key"], key: { to: { version: 1 } } }),
        expect.objectContaining({ fields: ["api_key"], key: { to: { version: 2 } } }),
      ])
    })
  },
})
