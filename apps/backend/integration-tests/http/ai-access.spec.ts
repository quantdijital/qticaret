import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

/**
 * adr/0071 §6, §8 (PR 0b-3): who may ask the AI core, the package's
 * "own key" flag as the workflow's first step, and the ask's rate limit.
 * Only the fake service is connected; nothing leaves the machine.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())

    managedForThisFile()

    beforeEach(async () => {
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("follows the role table: everyone reads the services, owner and admin ask and see use", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      const body = { task: "test_text", entity_type: "product", entity_id: productId }
      const statuses = async (headers: Record<string, string>) => {
        const asked = await ask(headers, body)
        const id = asked.data.suggestion?.id ?? "cdraft_none"
        return [
          (await settle(http.get("/admin/ai/services", { headers }))).status,
          asked.status,
          (await settle(http.post(`/admin/ai/suggestions/${id}/dismiss`, {}, { headers }))).status,
          (await settle(http.get("/admin/ai/usage", { headers }))).status,
        ]
      }

      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      expect(await statuses(owner.headers)).toEqual([200, 201, 200, 200])
      expect(await statuses(admin.headers)).toEqual([200, 201, 200, 200])
      // Aşama 9: a decision passes the route for operations (its review tasks), and the
      // workflow finds no open suggestion of theirs here
      expect(await statuses(operations.headers)).toEqual([200, 403, 400, 403])
      expect(await statuses(readonly.headers)).toEqual([200, 403, 403, 403])
      expect((await records().usages()).length).toBe(2)
    })

    it("tells the month's use by service and task, against the limits", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      await ask(owner.headers, { task: "test_text", entity_type: "product", entity_id: productId })

      const usage = await http.get<Record<string, unknown>>("/admin/ai/usage", {
        headers: owner.headers,
      })
      const old = await http.get<Record<string, unknown>>("/admin/ai/usage?month=2020-01", {
        headers: owner.headers,
      })
      const wrong = await settle(
        http.get("/admin/ai/usage?month=2020-13", { headers: owner.headers })
      )

      expect(usage.data).toMatchObject({
        services: [{ id: "fake", count: 1, succeeded: 1 }],
        tasks: [{ id: "test_text", count: 1 }],
        monthly: { used: 1, limit: null },
        daily: {
          text: { used: 1, limit: 500 },
          image: { used: 0, limit: 100 },
          video: { used: 0, limit: 10 },
        },
      })
      expect(old.data).toMatchObject({ month: "2020-01", services: [], tasks: [] })
      expect(wrong.status).toBe(400)
    })

    it("uses no stored key while the package has no own keys: refused first, nothing called", async () => {
      await connectFake(http, owner.headers, key)
      const productId = await aiProduct(getContainer())
      await pushPlan(http, false)
      const called = jest.spyOn(fakeTextConnector, "complete")

      const refused = await ask(owner.headers, {
        task: "test_text",
        entity_type: "product",
        entity_id: productId,
        service: "fake",
      })
      const listed = await http.get<{
        tasks: { id: string; usable: string[] }[]
        flags: { own_keys: boolean }
      }>("/admin/ai/services", { headers: owner.headers })

      expect([refused.status, refused.data.message]).toEqual([403, "ai.own_keys_not_in_plan"])
      expect(called).not.toHaveBeenCalled()
      expect(listed.data.flags.own_keys).toBe(false)
      expect(listed.data.tasks.find((task) => task.id === "test_text")?.usable).toEqual([])
      expect(await records().usages()).toEqual([])
      expect(await records().monthly()).toBe(0)
      expect(await records().today()).toBe(0)
    })

    // Last: the limit's tally lasts the file's app
    it("limits asks per staff member", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const tries: number[] = []
      for (let index = 0; index < 21; index += 1) {
        // An unknown task is refused after the limit has counted it: nothing is called
        tries.push(
          (
            await ask(member.headers, {
              task: "nope",
              entity_type: "product",
              entity_id: "prod_1",
            })
          ).status
        )
      }

      const first = tries.indexOf(429)
      expect(first).toBeGreaterThan(0)
      expect(first).toBeLessThanOrEqual(20)
      expect(tries.slice(0, first).every((status) => status === 400)).toBe(true)
    })
  },
})
