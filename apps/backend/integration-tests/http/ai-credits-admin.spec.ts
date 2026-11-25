import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { forgetProcessCaches } from "../../src/lib/cache/process-caches"
import { AI_PLATFORM_CREDITS } from "../../src/modules/platform-settings/features"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import {
  GATED_TITLE,
  PACK_500,
  availableStatus,
  chatAnswer,
  fakeAiGateway,
  keyAnswer,
  orderAnswer,
} from "../helpers/ai-gateway"
import { listen, managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Answer {
  message?: string
  [key: string]: unknown
}

/**
 * adr/0085 §3, K11 (P4b-2): the shop panel's routes for the platform's
 * credits against a stand-in control plane. Off, they say nothing and ask
 * nothing; on, the card's view is narrow (never the routing), a top-up
 * request is the owner's, its body the pack's id alone, sent signed with
 * no price; and a call on credits records what the gateway charged.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const gateway = fakeAiGateway()
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let url = ""

    managedForThisFile()

    beforeAll(async () => {
      url = await listen(gateway.server)
      process.env["CONTROL_PLANE_URL"] = url
    })

    afterAll(() => {
      gateway.server.close()
    })

    beforeEach(async () => {
      forgetProcessCaches()
      resetAiBreakers()
      process.env["CONTROL_PLANE_URL"] = url
      gateway.calls.length = 0
      gateway.orders.length = 0
      gateway.state.answers = []
      gateway.state.statusAsks = 0
      gateway.state.status = {
        ...availableStatus(),
        packs: [PACK_500],
        table: { seo_title: 1, image_scene: 40, video_teaser: 90 },
      }
      gateway.state.order = orderAnswer()
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const credits = (on: boolean) => pushPlan(http, true, {}, { [AI_PLATFORM_CREDITS]: on })
    const read = (headers: Record<string, string>) =>
      settle(http.get<Answer>("/admin/ai/credits", { headers }))
    const order = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Answer>("/admin/ai/credits/orders", body, { headers }))
    const seoTitle = async () => ({
      task: "seo_title",
      entity_type: "product",
      entity_id: await aiProduct(getContainer()),
    })

    it("says nothing and asks nobody while the flag is off", async () => {
      await credits(false)
      const view = await read(owner.headers)
      expect([view.status, view.data]).toEqual([200, { available: false }])
      const asked = await order(owner.headers, { pack_id: PACK_500.id })
      expect(asked.status).toBe(404)
      const services = await settle(
        http.get<{ services: { id: string }[] }>("/admin/ai/services", { headers: owner.headers })
      )
      expect(services.data.services.map((each) => each.id)).not.toContain("platform")
      expect([gateway.state.statusAsks, gateway.orders.length]).toEqual([0, 0])
    })

    it("gives the card its fields and never the routing", async () => {
      await credits(true)
      const view = await read(owner.headers)
      expect(view.status).toBe(200)
      expect(view.data).toEqual({
        available: true,
        plan: { remaining: 40, renews_on: "2026-12-01" },
        purchased: { remaining: 0, expires_on: null },
        daily: { cap: 300, remaining: 300 },
        tasks: { seo_title: 1, image_scene: 40 },
        packs: [PACK_500],
        pending_order: null,
      })
      const text = JSON.stringify(view.data)
      for (const hidden of ["services", "deepseek", "video_teaser"]) {
        expect(text).not.toContain(hidden)
      }
      const admin = await createAdminUser(http, getContainer(), "admin")
      expect((await read(admin.headers)).status).toBe(200)
      for (const role of ["operations", "readonly"] as const) {
        const other = await createAdminUser(http, getContainer(), role)
        expect((await read(other.headers)).status).toBe(403)
      }
    })

    it("passes the month's whole grant on when the control plane sends it (P5b)", async () => {
      await credits(true)
      const base = availableStatus()
      const plan = { ...base.balance.plan, granted: 100 }
      gateway.state.status = { ...base, balance: { ...base.balance, plan } }
      const view = await read(owner.headers)
      expect(view.status).toBe(200)
      expect(view.data).toMatchObject({ available: true, plan })
    })

    it("lists the platform as a service by its own name alone", async () => {
      await credits(true)
      const view = await settle(
        http.get<{
          services: Record<string, unknown>[]
          tasks: { id: string; usable: string[] }[]
        }>("/admin/ai/services", { headers: owner.headers })
      )
      const platform = view.data.services.find((each) => each["id"] === "platform")
      expect(platform).toEqual({
        id: "platform",
        capabilities: ["text"],
        status: "connected",
        funding: "platform_credit",
        data_note_key: "ai.data_note.platform",
        backgrounds: [],
        scene: false,
      })
      expect(view.data.tasks.find((each) => each.id === "seo_title")?.usable).toEqual(["platform"])
    })

    it("opens a top-up request for the owner, the pack's id alone sent signed", async () => {
      await credits(true)
      expect((await read(owner.headers)).status).toBe(200)
      expect(gateway.state.statusAsks).toBe(1)
      for (const role of ["admin", "operations"] as const) {
        const other = await createAdminUser(http, getContainer(), role)
        expect((await order(other.headers, { pack_id: PACK_500.id })).status).toBe(403)
      }
      const priced = await order(owner.headers, { pack_id: PACK_500.id, amount: 1 })
      expect(priced.status).toBe(400)
      expect(gateway.orders).toHaveLength(0)

      const asked = await order(owner.headers, { pack_id: PACK_500.id })
      expect(asked.status).toBe(201)
      expect(asked.data).toEqual({
        order: {
          id: "aicord_01",
          pack_id: PACK_500.id,
          credits: 500,
          amount: 25_000,
          currency: "TRY",
          status: "pending",
          requested_at: "2026-11-25T10:00:00.000Z",
        },
      })
      expect(gateway.orders).toHaveLength(1)
      const [sent] = gateway.orders
      expect(sent?.signed).toBe(true)
      expect(JSON.parse(sent?.body ?? "{}")).toEqual({
        pack_id: PACK_500.id,
        requested_by: owner.userId,
      })
      // The kept status is forgotten: the card reads the open request afresh
      await read(owner.headers)
      expect(gateway.state.statusAsks).toBe(2)
    })

    it.each([
      [keyAnswer(409, "cp.ai_credit_order_pending"), 409, "ai.credits_order_open"],
      [keyAnswer(404, "ai_credits.pack_unknown"), 409, "ai.credits_pack_unknown"],
      [keyAnswer(400, "ai_credits.unavailable"), 502, "ai.platform_unavailable"],
      [{ status: 500, headers: {}, body: "{}" }, 502, "ai.platform_unavailable"],
    ])("tells the control plane's answer %# as %s %s", async (answer, status, message) => {
      await credits(true)
      gateway.state.order = answer
      const asked = await order(owner.headers, { pack_id: PACK_500.id })
      expect([asked.status, asked.data.message]).toEqual([status, message])
    })

    it("tells an unreachable control plane as unavailable", async () => {
      await credits(true)
      process.env["CONTROL_PLANE_URL"] = "http://127.0.0.1:9"
      const asked = await order(owner.headers, { pack_id: PACK_500.id })
      expect([asked.status, asked.data.message]).toEqual([502, "ai.platform_unavailable"])
    })

    it("records what the gateway charged a call on credits, none on the shop's own key", async () => {
      await credits(true)
      gateway.state.answers = [chatAnswer(GATED_TITLE, 2)]
      expect((await ask(owner.headers, await seoTitle())).status).toBe(201)
      await connectFake(http, owner.headers, `test-key-${fakeSecret()}`)
      jest.spyOn(fakeTextConnector, "complete").mockResolvedValue({
        text: GATED_TITLE,
        usage: { inputTokens: 10, outputTokens: 10 },
      })
      expect((await ask(owner.headers, await seoTitle())).status).toBe(201)

      const rows = await records().usages()
      const platform = rows.filter((row) => row.service === "platform")
      expect(platform.map((row) => [row.funding, row.credits, row.model])).toEqual([
        ["platform_credit", 2, ""],
      ])
      const own = rows.filter((row) => row.service === "fake")
      expect(own.map((row) => [row.funding, row.credits])).toEqual([["own_key", null]])

      const usage = await settle(http.get<Answer>("/admin/ai/usage", { headers: owner.headers }))
      expect(usage.data["platform_credits"]).toEqual({
        calls: 1,
        credits: 2,
        tasks: [{ id: "seo_title", calls: 1, credits: 2 }],
      })
    })
  },
})
