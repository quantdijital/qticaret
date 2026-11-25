import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { forgetProcessCaches } from "../../src/lib/cache/process-caches"
import { AI_PLATFORM_CREDITS } from "../../src/modules/platform-settings/features"
import { createAdminUser } from "../helpers/admin"
import { pushPlan } from "../helpers/ai"
import { PACK_500, availableStatus, fakeAiGateway, orderAnswer } from "../helpers/ai-gateway"
import { listen, managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Answer {
  message?: string
  [key: string]: unknown
}

/** Words a control plane's error body carries that must never reach the shop's panel. */
const LEAK = "cp-internal-trace-7f3a"

/**
 * The security review of P4b-2: the top-up request's guards (a read-only
 * role and an API key are refused, the sixth request an hour is limited),
 * a 502 says nothing of the control plane's body, and the platform's row
 * routed to an image service names neither it nor its own backgrounds.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
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
      gateway.orders.length = 0
      gateway.state.status = {
        ...availableStatus({ text: "deepseek", image_edit: "photoroom" }),
        packs: [PACK_500],
        table: { seo_title: 1, image_background: 4, image_scene: 40 },
      }
      gateway.state.order = orderAnswer()
      owner = await createAdminUser(http, getContainer())
      await pushPlan(http, true, {}, { [AI_PLATFORM_CREDITS]: true })
    })

    const order = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Answer>("/admin/ai/credits/orders", body, { headers }))

    it("refuses a read-only role, an API key and no session, asking nobody", async () => {
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      expect((await order(readonly.headers, { pack_id: PACK_500.id })).status).toBe(403)
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")
      const byKey = await order({ authorization: `Basic ${basic}` }, { pack_id: PACK_500.id })
      expect(byKey.status).toBe(403)
      expect((await order({}, { pack_id: PACK_500.id })).status).toBe(401)
      expect(gateway.orders).toHaveLength(0)
    })

    it("says nothing of the control plane's body when it fails", async () => {
      gateway.state.order = {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "error", message: LEAK, stack: LEAK }),
      }
      const asked = await order(owner.headers, { pack_id: PACK_500.id })
      expect([asked.status, asked.data.message]).toEqual([502, "ai.platform_unavailable"])
      expect(JSON.stringify(asked.data)).not.toContain(LEAK)
    })

    it("lists the platform routed to an image service by its own name and backgrounds", async () => {
      const view = await settle(
        http.get<{ services: Record<string, unknown>[] }>("/admin/ai/services", {
          headers: owner.headers,
        })
      )
      const platform = view.data.services.find((each) => each["id"] === "platform")
      expect(platform).toEqual({
        id: "platform",
        capabilities: ["text", "image_edit"],
        status: "connected",
        funding: "platform_credit",
        data_note_key: "ai.data_note.platform",
        backgrounds: ["white"],
        scene: true,
      })
      expect(JSON.stringify(platform)).not.toMatch(/photoroom|transparent|segment|sdk\./)
    })

    // Last: the limit's tally lasts the file's app
    it("limits a staff member to five top-up requests an hour", async () => {
      const statuses: number[] = []
      for (let index = 0; index < 6; index += 1) {
        statuses.push((await order(owner.headers, { pack_id: PACK_500.id })).status)
      }
      expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
      expect(gateway.orders).toHaveLength(5)
    })
  },
})
